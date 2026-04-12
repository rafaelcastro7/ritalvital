"""
RutaVital IA – Pipeline de datos
Calcula el Índice de Riesgo de Continuidad Asistencial (IRCA) a nivel municipal.

Descarga directamente desde datos.gov.co (Socrata API) — sin archivos locales CSV.

Fuentes oficiales:
  DIVIPOLA    gdxc-w37w  → DANE — llave territorial, coordenadas
  REPS        s2ru-bqt6  → MinSalud — Capacidad Instalada (camas habilitadas)
  UNGRD hist  wwkg-r6te  → UNGRD — Emergencias 2019-2022
  UNGRD rec.  rgre-6ak4  → UNGRD — Emergencias 2023-2024
  DANE pob.   integrado  → Proyecciones municipales 2018-2035

Uso:
  pip install -r requirements.txt
  python pipeline.py

  # Con App Token para mayor rate limit:
  DATOS_GOV_TOKEN=xxx python pipeline.py

Genera:
  outputs/municipios_riesgo.csv
  outputs/metadata_pipeline.txt
"""

import os
import sys
import logging
import pandas as pd
import numpy as np
import requests
from sklearn.preprocessing import QuantileTransformer

# ─────────────────────────────────────────────
# CONFIGURACIÓN
# ─────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
OUT_DIR     = os.path.join(BASE_DIR, "outputs")
os.makedirs(OUT_DIR, exist_ok=True)

SOCRATA_BASE = "https://www.datos.gov.co/resource"
APP_TOKEN    = os.environ.get("DATOS_GOV_TOKEN", "")
TIMEOUT      = 60  # segundos por request

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("rutavital")


# ─────────────────────────────────────────────
# REFERENCIA TERRITORIAL — 32 municipios Chocó
# ─────────────────────────────────────────────
MUN_CHOCO = [
    (27001, "Quibdó",                 122000),
    (27006, "Acandí",                  9800),
    (27025, "Alto Baudó",             14200),
    (27050, "Atrato",                  8500),
    (27073, "Bagadó",                  7300),
    (27075, "Bahía Solano",           11000),
    (27077, "Bajo Baudó",             19500),
    (27086, "Belén de Bajirá",        21000),
    (27099, "Bojayá",                  9200),
    (27135, "El Cantón del San Pablo", 4800),
    (27150, "Carmen del Darién",       7600),
    (27160, "Cértegui",                6100),
    (27205, "Condoto",                15200),
    (27245, "El Carmen de Atrato",    14800),
    (27250, "El Litoral del San Juan",  8900),
    (27361, "Istmina",                22000),
    (27372, "Juradó",                  3200),
    (27413, "Lloró",                   8700),
    (27425, "Medio Atrato",           10500),
    (27430, "Medio Baudó",             8200),
    (27450, "Medio San Juan",         12800),
    (27491, "Nóvita",                  8100),
    (27495, "Nuquí",                   7400),
    (27580, "Río Iró",                 6900),
    (27600, "Río Quito",               7200),
    (27615, "Riosucio",               28000),
    (27660, "San José del Palmar",     5600),
    (27745, "Sipí",                    4100),
    (27787, "Tadó",                   17600),
    (27800, "Unguía",                 16400),
    (27810, "Unión Panamericana",      8900),
]
CHOCO_CODES = {cod for cod, _, _ in MUN_CHOCO}

def normalize_str(s: str) -> str:
    """Minúsculas + elimina tildes."""
    import unicodedata
    return unicodedata.normalize("NFD", s.lower()).encode("ascii", "ignore").decode()


def name_to_cod():
    return {normalize_str(name): cod for cod, name, _ in MUN_CHOCO}


# ─────────────────────────────────────────────
# DESCARGA SOCRATA
# ─────────────────────────────────────────────
def socrata_fetch(dataset_id: str, where: str, limit: int = 50_000) -> list[dict]:
    """Descarga filas desde datos.gov.co con la query SoQL indicada."""
    headers = {"Accept": "application/json"}
    if APP_TOKEN:
        headers["X-App-Token"] = APP_TOKEN

    params = {"$where": where, "$limit": str(limit)}
    url = f"{SOCRATA_BASE}/{dataset_id}.json"

    try:
        r = requests.get(url, params=params, headers=headers, timeout=TIMEOUT)
        r.raise_for_status()
        return r.json()
    except requests.HTTPError as e:
        # Intentar extraer el mensaje de Socrata
        try:
            detail = r.json().get("message", str(e))
        except Exception:
            detail = str(e)
        raise RuntimeError(f"HTTP error en {dataset_id}: {detail}") from e
    except requests.RequestException as e:
        raise RuntimeError(f"Error de red al consultar {dataset_id}: {e}") from e


def socrata_fetch_with_fallback(
    dataset_id: str,
    strategies: list[str],
    limit: int = 50_000,
) -> list[dict]:
    """Intenta varias estrategias WHERE; devuelve el primer resultado no vacío."""
    last_err = None
    for i, where in enumerate(strategies):
        try:
            rows = socrata_fetch(dataset_id, where, limit)
            log.info("  Dataset %s: estrategia %d OK → %d filas", dataset_id, i, len(rows))
            return rows
        except RuntimeError as e:
            last_err = e
            log.warning("  Estrategia %d fallida para %s: %s", i, dataset_id, e)
            if "Error de red" in str(e):
                break  # no reintentar si es error de red
    raise RuntimeError(f"Todas las estrategias fallaron para {dataset_id}") from last_err


# ─────────────────────────────────────────────
# FETCHERS POR FUENTE
# ─────────────────────────────────────────────
def fetch_reps() -> pd.DataFrame:
    """REPS Capacidad Instalada (s2ru-bqt6) — camas habilitadas en Chocó."""
    log.info("Descargando REPS (s2ru-bqt6)…")
    ntc = name_to_cod()

    rows = socrata_fetch_with_fallback("s2ru-bqt6", [
        "nom_grupo_capacidad='CAMAS' AND departamento='CHOCÓ'",
        "nom_grupo_capacidad='CAMAS'",
    ], limit=100_000)

    df = pd.DataFrame(rows)
    if df.empty:
        log.warning("REPS: sin datos — se usarán camas = 0 para todos los municipios")
        return pd.DataFrame(columns=["cod_municipio", "camas_habilitadas"])

    # Filtro client-side a Chocó
    def is_choco(r):
        dept = normalize_str(str(r.get("departamento", "")))
        if "choc" in dept:
            return True
        mun = normalize_str(str(r.get("municipio", r.get("municipiosededesc", ""))))
        return mun in ntc

    df_choco = df[df.apply(is_choco, axis=1)].copy()
    log.info("REPS: %d filas totales → %d en Chocó", len(df), len(df_choco))

    df_choco["camas_n"] = pd.to_numeric(
        df_choco.get("num_cantidad_capacidad_instalada", 0), errors="coerce"
    ).fillna(0)

    # Join por nombre de municipio normalizado
    df_choco["mun_norm"] = df_choco.apply(
        lambda r: normalize_str(str(r.get("municipio", r.get("municipiosededesc", "")))), axis=1
    )
    df_choco["cod_municipio"] = df_choco["mun_norm"].map(ntc)
    df_choco.dropna(subset=["cod_municipio"], inplace=True)
    df_choco["cod_municipio"] = df_choco["cod_municipio"].astype(int)

    cap = df_choco.groupby("cod_municipio", as_index=False).agg(
        camas_habilitadas=("camas_n", "sum")
    )
    log.info("REPS: %d municipios con camas registradas", len(cap))
    return cap


def fetch_ungrd() -> pd.DataFrame:
    """UNGRD Hist (wwkg-r6te) + Reciente (rgre-6ak4) fusionados."""
    log.info("Descargando UNGRD histórico (wwkg-r6te)…")
    strategies_divipola = [
        "divipola like '27%'",
        "starts_with(divipola, '27')",
        "cod_dpto = '27'",
        "departamento = 'CHOCÓ'",
        "1=1",
    ]

    rows_hist   = socrata_fetch_with_fallback("wwkg-r6te", strategies_divipola)
    log.info("Descargando UNGRD reciente (rgre-6ak4)…")
    rows_recent = socrata_fetch_with_fallback("rgre-6ak4", strategies_divipola)

    all_rows = rows_hist + rows_recent
    if not all_rows:
        log.warning("UNGRD: sin datos — se usarán eventos = 0")
        return pd.DataFrame(columns=["cod_municipio", "total_eventos", "severidad_vial"])

    df = pd.DataFrame(all_rows)

    # Normalizar campo divipola (puede tener nombres distintos entre datasets)
    for field in ("divipola", "cod_divipola", "codigo_divipola"):
        if field in df.columns:
            df["_divipola"] = pd.to_numeric(df[field], errors="coerce")
            break
    else:
        df["_divipola"] = np.nan

    df_choco = df[df["_divipola"].isin(CHOCO_CODES)].copy()
    log.info("UNGRD: %d filas totales → %d en Chocó", len(df), len(df_choco))

    df_choco["vias"]    = pd.to_numeric(df_choco.get("vias_averiadas",           0), errors="coerce").fillna(0)
    df_choco["puentes"] = (
        pd.to_numeric(df_choco.get("puentes_vehiculares",  0), errors="coerce").fillna(0) +
        pd.to_numeric(df_choco.get("puentes_peatonales",   0), errors="coerce").fillna(0)
    )

    mun = df_choco.groupby("_divipola", as_index=False).agg(
        total_eventos=("_divipola", "count"),
        total_vias   =("vias",      "sum"),
        total_puentes=("puentes",   "sum"),
    )
    mun["cod_municipio"] = mun["_divipola"].astype(int)
    mun["severidad_vial"] = np.where(
        mun["total_eventos"] > 0,
        (mun["total_vias"] + mun["total_puentes"]) / mun["total_eventos"],
        0.0,
    )
    log.info("UNGRD: %d municipios con eventos registrados", len(mun))
    return mun[["cod_municipio", "total_eventos", "severidad_vial"]]


# ─────────────────────────────────────────────
# PIPELINE PRINCIPAL
# ─────────────────────────────────────────────
def build_base() -> pd.DataFrame:
    """Construye la tabla base con los 32 municipios de Chocó."""
    return pd.DataFrame(
        [(cod, name, "Chocó", pob) for cod, name, pob in MUN_CHOCO],
        columns=["cod_municipio", "municipio", "depto", "poblacion"],
    )


def integrar(base: pd.DataFrame, reps: pd.DataFrame, ungrd: pd.DataFrame) -> pd.DataFrame:
    df = base.merge(reps,  on="cod_municipio", how="left")
    df = df.merge(ungrd, on="cod_municipio", how="left")
    df["camas_habilitadas"] = df["camas_habilitadas"].fillna(0)
    df["total_eventos"]     = df["total_eventos"].fillna(0)
    df["severidad_vial"]    = df["severidad_vial"].fillna(0)
    return df


def calcular_indicadores(df: pd.DataFrame) -> pd.DataFrame:
    df["camas_por_1000_hab"] = np.where(
        df["poblacion"] > 0,
        df["camas_habilitadas"] / (df["poblacion"] / 1000),
        0.0,
    )

    qt = QuantileTransformer(output_distribution="uniform", random_state=42)
    df["pctl_vuln_salud"] = 1.0 - qt.fit_transform(df[["camas_por_1000_hab"]]).flatten()
    df["pctl_exposicion"] = qt.fit_transform(df[["total_eventos"]]).flatten()
    df["pctl_severidad"]  = qt.fit_transform(df[["severidad_vial"]]).flatten()
    df["iraa_score"]      = (df["pctl_vuln_salud"] + df["pctl_exposicion"] + df["pctl_severidad"]) / 3
    return df


def categorizar(df: pd.DataFrame) -> pd.DataFrame:
    df["sin_eventos_reportados"] = df["total_eventos"] == 0
    df["expuestos"]              = df["total_eventos"] > 0
    df["poblacion_imputada"]     = False

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
    ).astype(str)

    RECOM = {
        "Crítico": "Notificar al comité departamental de gestión del riesgo y revisar la red de referencia del municipio en las próximas 24 horas.",
        "Alto":    "Notificar al comité departamental y verificar disponibilidad operativa básica y planes de contingencia.",
        "Medio":   "Solicitar validación del plan local de contingencia y seguimiento territorial reforzado.",
        "Bajo":    "Monitoreo sin acción inmediata e inclusión en reporte departamental.",
    }
    df["recomendacion"] = df["nivel_riesgo"].map(RECOM)
    return df


def exportar(df: pd.DataFrame) -> None:
    COLS = [
        "cod_municipio", "municipio", "depto",
        "poblacion", "poblacion_imputada",
        "camas_totales", "camas_por_1000_hab",
        "total_eventos", "severidad_vial", "expuestos", "sin_eventos_reportados",
        "pctl_vuln_salud", "pctl_exposicion", "pctl_severidad",
        "iraa_score", "nivel_riesgo", "estado_confianza", "recomendacion",
    ]
    df = df.rename(columns={"camas_habilitadas": "camas_totales"})
    csv_path  = os.path.join(OUT_DIR, "municipios_riesgo.csv")
    meta_path = os.path.join(OUT_DIR, "metadata_pipeline.txt")

    df[COLS].to_csv(csv_path, index=False, encoding="utf-8-sig")
    log.info("CSV exportado: %s (%d filas)", csv_path, len(df))

    dist = df["nivel_riesgo"].value_counts().to_dict()
    with open(meta_path, "w", encoding="utf-8") as f:
        f.write(f"Pipeline ejecutado   : {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Total municipios     : {len(df)}\n")
        f.write(f"Sin eventos rept.    : {df['sin_eventos_reportados'].sum()}\n")
        f.write(f"Distribución riesgo  : {dict(dist)}\n")
        f.write("Fuentes              : DIVIPOLA gdxc-w37w, REPS s2ru-bqt6, UNGRD wwkg-r6te + rgre-6ak4, DANE proyecciones integradas\n")
        f.write("Datos                : 100% datos abiertos oficiales datos.gov.co\n")
        f.write("Nota                 : sin_eventos_reportados=True puede reflejar subregistro.\n")
    log.info("Metadatos exportados: %s", meta_path)


def validar(df: pd.DataFrame) -> None:
    if df["iraa_score"].isna().any():
        log.error("VALIDACIÓN: NaN en iraa_score — abortando")
        sys.exit(1)
    sin_ev = df["sin_eventos_reportados"].mean()
    if sin_ev > 0.5:
        log.warning("%.0f%% de municipios sin eventos UNGRD (posible subregistro)", sin_ev * 100)
    log.info("Top 5 IRCA: %s",
             df.nlargest(5, "iraa_score")[["municipio", "iraa_score", "nivel_riesgo"]]
               .to_dict("records"))


def main() -> None:
    log.info("=== RutaVital IA – Pipeline (datos.gov.co) iniciado ===")

    reps  = fetch_reps()
    ungrd = fetch_ungrd()

    df = build_base()
    df = integrar(df, reps, ungrd)
    df = calcular_indicadores(df)
    df = categorizar(df)

    validar(df)
    exportar(df)

    log.info("=== Pipeline completado — copiar outputs/municipios_riesgo.csv a public/data/ ===")


if __name__ == "__main__":
    main()
