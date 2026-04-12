"""
RutaVital IA – Pipeline de datos
Calcula el Índice de Riesgo de Continuidad Asistencial (IRCA) a nivel municipal.

Fuentes oficiales:
  - DIVIPOLA (DANE): llave territorial
  - Proyecciones de población (DANE)
  - REPS nacional consolidado (MinSalud, datos.gov.co: c36g-9fc2)
  - Emergencias UNGRD (datos.gov.co)

Uso:
  python pipeline.py

Genera:
  outputs/municipios_riesgo.csv
  outputs/metadata_pipeline.txt
"""

import os
import sys
import logging
import pandas as pd
import numpy as np
from sklearn.preprocessing import QuantileTransformer

# ─────────────────────────────────────────────
# CONFIGURACIÓN
# ─────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUT_DIR  = os.path.join(BASE_DIR, "outputs")

os.makedirs(OUT_DIR, exist_ok=True)

PATHS = {
    "divipola":  os.path.join(DATA_DIR, "divipola.csv"),
    "poblacion": os.path.join(DATA_DIR, "poblacion_dane.csv"),
    "reps":      os.path.join(DATA_DIR, "reps_nacional.csv"),
    "ungrd":     os.path.join(DATA_DIR, "emergencias_ungrd.csv"),
}

DEPARTAMENTO_PILOTO = None   # None = todos los deptos; o ej. "Chocó" para filtrar

# ─────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("rutavital")


def verificar_archivos():
    """Confirma que todos los archivos de entrada existen."""
    faltantes = [k for k, p in PATHS.items() if not os.path.exists(p)]
    if faltantes:
        log.error("Archivos de entrada no encontrados: %s", faltantes)
        log.error("Revisa la carpeta data/ o consulta el README.md")
        sys.exit(1)
    log.info("Archivos de entrada verificados OK")


def cargar_fuentes():
    """Lee los cuatro CSVs y hace limpieza mínima de tipos."""
    divipola  = pd.read_csv(PATHS["divipola"],  dtype={"cod_municipio": int})
    poblacion = pd.read_csv(PATHS["poblacion"], dtype={"cod_municipio": int})
    reps      = pd.read_csv(PATHS["reps"],      dtype={"codigo_municipio": int})
    ungrd     = pd.read_csv(PATHS["ungrd"],     dtype={"cod_municipio": int})

    # Nombres de columna estandarizados
    reps.rename(columns={"codigo_municipio": "cod_municipio"}, inplace=True)

    # Fecha UNGRD
    ungrd["fecha"] = pd.to_datetime(ungrd["fecha"], errors="coerce")
    ungrd.dropna(subset=["fecha"], inplace=True)

    log.info("Cargadas: DIVIPOLA=%d muns, Poblacion=%d, REPS=%d sedes, UNGRD=%d eventos",
             len(divipola), len(poblacion), len(reps), len(ungrd))
    return divipola, poblacion, reps, ungrd


def filtrar_piloto(divipola, departamento):
    """Filtra la base territorial al departamento piloto si se especifica."""
    if departamento:
        original = len(divipola)
        divipola = divipola[divipola["depto"] == departamento].copy()
        log.info("Filtro piloto '%s': %d → %d municipios", departamento, original, len(divipola))
    return divipola


def definir_ventana_temporal(ungrd):
    """Calcula los últimos 5 años calendario completos disponibles en UNGRD."""
    anio_fin   = int(ungrd["fecha"].dt.year.max())
    anio_inicio = anio_fin - 4
    fecha_inicio = pd.Timestamp(year=anio_inicio, month=1,  day=1)
    fecha_fin    = pd.Timestamp(year=anio_fin,    month=12, day=31)
    log.info("Ventana temporal UNGRD: %s a %s", fecha_inicio.date(), fecha_fin.date())
    return fecha_inicio, fecha_fin


def agregar_capacidad(reps):
    """Suma camas habilitadas por municipio (solo sedes ACTIVAS)."""
    activos = reps[reps["estado_habilitacion"] == "ACTIVO"].copy()
    cap = (
        activos.groupby("cod_municipio", as_index=False)
               .agg(camas_totales=("camas_habilitadas", "sum"))
    )
    log.info("REPS activas: %d sedes → %d municipios con camas", len(activos), len(cap))
    return cap


def agregar_eventos(ungrd, fecha_inicio, fecha_fin):
    """Agrega eventos UNGRD por municipio dentro de la ventana temporal."""
    ventana = ungrd[(ungrd["fecha"] >= fecha_inicio) & (ungrd["fecha"] <= fecha_fin)].copy()
    log.info("Eventos en ventana: %d de %d totales", len(ventana), len(ungrd))

    mun = (
        ventana.groupby("cod_municipio", as_index=False)
               .agg(
                   total_eventos=("fecha",           "count"),
                   total_vias   =("vias_averiadas",  "sum"),
                   total_puentes=("puentes_afectados","sum"),
               )
    )
    mun["severidad_vial"] = np.where(
        mun["total_eventos"] > 0,
        (mun["total_vias"] + mun["total_puentes"]) / mun["total_eventos"],
        0.0,
    )
    return mun


def integrar(divipola, poblacion, cap, eventos_mun):
    """Left join desde DIVIPOLA como llave territorial maestra."""
    df = divipola.copy()
    df = df.merge(poblacion[["cod_municipio", "poblacion"]], on="cod_municipio", how="left")
    df = df.merge(cap, on="cod_municipio", how="left")
    df = df.merge(
        eventos_mun[["cod_municipio", "total_eventos", "severidad_vial"]],
        on="cod_municipio", how="left"
    )
    df[["camas_totales", "total_eventos", "severidad_vial"]] = (
        df[["camas_totales", "total_eventos", "severidad_vial"]].fillna(0)
    )
    log.info("Integración completada: %d municipios", len(df))
    return df


def imputar_poblacion(df):
    """
    Imputa con mediana departamental los municipios sin población válida.
    Marca la bandera poblacion_imputada=True en esos registros.
    """
    df["poblacion_imputada"] = False
    imputados = 0
    for depto in df["depto"].dropna().unique():
        mask     = df["depto"] == depto
        faltante = mask & (df["poblacion"].isna() | (df["poblacion"] <= 0))
        n = faltante.sum()
        if n > 0:
            mediana = df.loc[mask & df["poblacion"].gt(0), "poblacion"].median()
            df.loc[faltante, "poblacion"]           = mediana
            df.loc[faltante, "poblacion_imputada"]  = True
            imputados += n
    if imputados:
        log.warning("Población imputada (mediana depto) en %d municipios", imputados)
    return df


def calcular_indicadores(df):
    """Calcula camas por 1.000 hab y los tres percentiles robustos."""
    df["camas_por_1000_hab"] = np.where(
        df["poblacion"] > 0,
        df["camas_totales"] / (df["poblacion"] / 1000),
        0.0,
    )

    qt = QuantileTransformer(output_distribution="uniform", random_state=42)

    df["pctl_vuln_salud"] = 1.0 - qt.fit_transform(df[["camas_por_1000_hab"]]).flatten()
    df["pctl_exposicion"] = qt.fit_transform(df[["total_eventos"]]).flatten()
    df["pctl_severidad"]  = qt.fit_transform(df[["severidad_vial"]]).flatten()

    df["iraa_score"] = (
        df["pctl_vuln_salud"] + df["pctl_exposicion"] + df["pctl_severidad"]
    ) / 3

    return df


def categorizar(df):
    """Asigna nivel de riesgo, banderas de confianza y recomendaciones operativas."""
    df["sin_eventos_reportados"] = df["total_eventos"] == 0
    df["expuestos"]              = df["total_eventos"] > 0

    df["estado_confianza"] = np.where(
        df["sin_eventos_reportados"],
        "Baja - validación requerida",
        "Alta",
    )

    df["nivel_riesgo"] = pd.cut(
        df["iraa_score"],
        bins=[0.0, 0.25, 0.50, 0.75, 1.001],
        labels=["Bajo", "Medio", "Alto", "Crítico"],
        include_lowest=True,
    )

    def recomendar(row):
        nr = str(row["nivel_riesgo"])
        if nr == "Crítico":
            return (
                "Notificar al comité departamental de gestión del riesgo "
                "y revisar la red de referencia del municipio en las próximas 24 horas."
            )
        if nr == "Alto":
            return (
                "Notificar al comité departamental y verificar "
                "disponibilidad operativa básica y planes de contingencia."
            )
        if nr == "Medio":
            return (
                "Solicitar validación del plan local de contingencia "
                "y seguimiento territorial reforzado."
            )
        return "Monitoreo sin acción inmediata e inclusión en reporte departamental."

    df["recomendacion"] = df.apply(recomendar, axis=1)
    return df


def exportar(df, fecha_inicio, fecha_fin):
    """Escribe el CSV final y los metadatos."""
    columnas = [
        "cod_municipio", "municipio", "depto",
        "poblacion", "poblacion_imputada",
        "camas_totales", "camas_por_1000_hab",
        "total_eventos", "severidad_vial", "expuestos", "sin_eventos_reportados",
        "pctl_vuln_salud", "pctl_exposicion", "pctl_severidad",
        "iraa_score", "nivel_riesgo", "estado_confianza", "recomendacion",
    ]
    csv_path = os.path.join(OUT_DIR, "municipios_riesgo.csv")
    df[columnas].to_csv(csv_path, index=False, encoding="utf-8-sig")
    log.info("CSV exportado: %s (%d filas)", csv_path, len(df))

    meta_path = os.path.join(OUT_DIR, "metadata_pipeline.txt")
    dist = df["nivel_riesgo"].value_counts().to_dict()
    with open(meta_path, "w", encoding="utf-8") as f:
        f.write(f"Pipeline ejecutado   : {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Ventana UNGRD        : {fecha_inicio.date()} a {fecha_fin.date()}\n")
        f.write(f"Total municipios     : {len(df)}\n")
        f.write(f"Imputación pob.      : {df['poblacion_imputada'].sum()}\n")
        f.write(f"Sin eventos rept.    : {df['sin_eventos_reportados'].sum()}\n")
        f.write(f"Distribución riesgo  : {dict(dist)}\n")
        f.write("Fuentes              : DIVIPOLA, DANE proyecciones, REPS (c36g-9fc2), UNGRD\n")
        f.write("Nota                 : sin_eventos_reportados=True puede reflejar subregistro.\n")
    log.info("Metadatos exportados: %s", meta_path)


def validar(df):
    """Chequeos rápidos de sanidad antes de exportar."""
    errores = []
    if df["iraa_score"].isna().any():
        errores.append("Hay valores NaN en iraa_score")
    if (df["pctl_vuln_salud"] < 0).any() or (df["pctl_vuln_salud"] > 1).any():
        errores.append("pctl_vuln_salud fuera de [0,1]")
    sin_ev = df["sin_eventos_reportados"].mean()
    if sin_ev > 0.50:
        log.warning("%.0f%% de municipios sin eventos reportados — posible subregistro alto", sin_ev * 100)
    porc_imp = df["poblacion_imputada"].mean()
    if porc_imp > 0.10:
        log.warning("%.0f%% de municipios con población imputada", porc_imp * 100)
    if errores:
        for e in errores:
            log.error("VALIDACIÓN: %s", e)
        sys.exit(1)
    log.info("Validaciones OK — top 5 IRCA: %s",
             df.nlargest(5, "iraa_score")[["municipio","iraa_score","nivel_riesgo"]]
               .to_dict("records"))


# ─────────────────────────────────────────────
# EJECUCIÓN PRINCIPAL
# ─────────────────────────────────────────────
def main():
    log.info("=== RutaVital IA – Pipeline iniciado ===")
    verificar_archivos()

    divipola, poblacion, reps, ungrd = cargar_fuentes()
    divipola = filtrar_piloto(divipola, DEPARTAMENTO_PILOTO)

    fecha_inicio, fecha_fin = definir_ventana_temporal(ungrd)
    cap        = agregar_capacidad(reps)
    eventos_mun = agregar_eventos(ungrd, fecha_inicio, fecha_fin)

    df = integrar(divipola, poblacion, cap, eventos_mun)
    df = imputar_poblacion(df)
    df = calcular_indicadores(df)
    df = categorizar(df)

    validar(df)
    exportar(df, fecha_inicio, fecha_fin)

    log.info("=== Pipeline completado ===")


if __name__ == "__main__":
    main()
