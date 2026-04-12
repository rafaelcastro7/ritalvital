"""
RutaVital IA – Dashboard de priorización territorial
Visualiza el IRCA municipal sobre un mapa interactivo de Chocó.

Uso:
  streamlit run app.py

Requiere haber ejecutado pipeline.py primero para generar:
  outputs/municipios_riesgo.csv
"""

import os
import json
import warnings
import pandas as pd
import streamlit as st

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────
# CONFIGURACIÓN
# ─────────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
CSV_PATH  = os.path.join(BASE_DIR, "outputs", "municipios_riesgo.csv")
META_PATH = os.path.join(BASE_DIR, "outputs", "metadata_pipeline.txt")
GEO_PATH  = os.path.join(BASE_DIR, "data",    "choco_municipios.geojson")

COLORES_RIESGO = {
    "Bajo":    "#2ecc71",
    "Medio":   "#f39c12",
    "Alto":    "#e67e22",
    "Crítico": "#c0392b",
}

st.set_page_config(
    page_title="RutaVital IA",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─────────────────────────────────────────────
# CSS PERSONALIZADO
# ─────────────────────────────────────────────
st.markdown("""
<style>
  .badge-critico  { background:#c0392b; color:#fff; border-radius:6px; padding:2px 10px; font-size:12px; font-weight:600; }
  .badge-alto     { background:#e67e22; color:#fff; border-radius:6px; padding:2px 10px; font-size:12px; font-weight:600; }
  .badge-medio    { background:#f39c12; color:#fff; border-radius:6px; padding:2px 10px; font-size:12px; font-weight:600; }
  .badge-bajo     { background:#2ecc71; color:#fff; border-radius:6px; padding:2px 10px; font-size:12px; font-weight:600; }
  .advertencia-baja { background:#fff3cd; border-left:4px solid #ffc107; padding:8px 12px;
                       border-radius:4px; font-size:13px; margin:8px 0; }
  .kpi-box { background:#f8f9fa; border-radius:10px; padding:16px; text-align:center; }
  .kpi-number { font-size:28px; font-weight:700; }
  .kpi-label  { font-size:12px; color:#666; }
</style>
""", unsafe_allow_html=True)


# ─────────────────────────────────────────────
# CARGA DE DATOS
# ─────────────────────────────────────────────
@st.cache_data
def cargar_datos():
    if not os.path.exists(CSV_PATH):
        st.error("❌ No se encontró outputs/municipios_riesgo.csv. Ejecuta primero: python pipeline.py")
        st.stop()
    df = pd.read_csv(CSV_PATH)
    df["nivel_riesgo"] = df["nivel_riesgo"].astype(str)
    return df


@st.cache_data
def cargar_metadatos():
    if not os.path.exists(META_PATH):
        return {}
    meta = {}
    with open(META_PATH, encoding="utf-8") as f:
        for line in f:
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
    return meta


@st.cache_data
def cargar_geo():
    if not os.path.exists(GEO_PATH):
        return None
    with open(GEO_PATH, encoding="utf-8") as f:
        return json.load(f)


def badge_riesgo(nivel):
    cls = {
        "Crítico": "badge-critico",
        "Alto":    "badge-alto",
        "Medio":   "badge-medio",
        "Bajo":    "badge-bajo",
    }.get(nivel, "badge-bajo")
    return f'<span class="{cls}">{nivel}</span>'


# ─────────────────────────────────────────────
# APP PRINCIPAL
# ─────────────────────────────────────────────
def main():
    df   = cargar_datos()
    meta = cargar_metadatos()
    geo  = cargar_geo()

    # ──── BARRA LATERAL ────
    with st.sidebar:
        st.image("https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/"
                 "Hospital/Color/hospital_color.svg", width=48)
        st.title("RutaVital IA")
        st.caption("Priorización territorial de continuidad asistencial")
        st.divider()

        # Filtros
        st.subheader("Filtros")
        niveles = ["Todos"] + sorted(df["nivel_riesgo"].dropna().unique().tolist(),
                                      key=lambda x: ["Bajo","Medio","Alto","Crítico"].index(x)
                                      if x in ["Bajo","Medio","Alto","Crítico"] else 99)
        nivel_sel = st.selectbox("Nivel de riesgo", niveles)
        solo_baja_confianza = st.checkbox("Solo baja confianza", value=False)

        st.divider()
        st.subheader("Metadatos del pipeline")
        if meta:
            for k, v in meta.items():
                if k in ["Ventana UNGRD", "Pipeline ejecutado", "Total municipios"]:
                    st.markdown(f"**{k}:** {v}")
        else:
            st.info("Ejecuta pipeline.py para ver metadatos.")

        st.divider()
        st.caption("Fuentes: DIVIPOLA · DANE · REPS · UNGRD")
        st.caption("Modelo: IRCA = promedio(pctil_vuln, pctil_expo, pctil_sev)")

    # ──── FILTRADO ────
    df_vis = df.copy()
    if nivel_sel != "Todos":
        df_vis = df_vis[df_vis["nivel_riesgo"] == nivel_sel]
    if solo_baja_confianza:
        df_vis = df_vis[df_vis["estado_confianza"] == "Baja - validación requerida"]

    # ──── HEADER ────
    st.markdown("## 🏥 RutaVital IA – Riesgo de continuidad asistencial")
    st.caption("Chocó · Datos sintéticos de demostración · Reemplazar por fuentes oficiales en producción")

    # ──── KPIs ────
    c1, c2, c3, c4, c5 = st.columns(5)
    dist = df["nivel_riesgo"].value_counts()
    with c1:
        st.markdown(f'<div class="kpi-box"><div class="kpi-number">{len(df)}</div>'
                    f'<div class="kpi-label">Municipios</div></div>', unsafe_allow_html=True)
    with c2:
        n = dist.get("Crítico", 0)
        st.markdown(f'<div class="kpi-box" style="border-top:4px solid #c0392b">'
                    f'<div class="kpi-number" style="color:#c0392b">{n}</div>'
                    f'<div class="kpi-label">Críticos</div></div>', unsafe_allow_html=True)
    with c3:
        n = dist.get("Alto", 0)
        st.markdown(f'<div class="kpi-box" style="border-top:4px solid #e67e22">'
                    f'<div class="kpi-number" style="color:#e67e22">{n}</div>'
                    f'<div class="kpi-label">Alto riesgo</div></div>', unsafe_allow_html=True)
    with c4:
        n = df["sin_eventos_reportados"].sum()
        st.markdown(f'<div class="kpi-box" style="border-top:4px solid #ffc107">'
                    f'<div class="kpi-number" style="color:#f39c12">{n}</div>'
                    f'<div class="kpi-label">Sin eventos rept.</div></div>', unsafe_allow_html=True)
    with c5:
        irca_med = df["iraa_score"].median()
        st.markdown(f'<div class="kpi-box">'
                    f'<div class="kpi-number">{irca_med:.2f}</div>'
                    f'<div class="kpi-label">IRCA mediana</div></div>', unsafe_allow_html=True)

    st.markdown("")

    # ──── MAPA + PANEL LATERAL ────
    col_mapa, col_panel = st.columns([2.2, 1])

    with col_mapa:
        st.subheader("Mapa de riesgo")

        if geo is not None:
            try:
                import folium
                from streamlit_folium import folium_static

                m = folium.Map(location=[5.5, -76.8], zoom_start=7,
                               tiles="CartoDB positron")
                folium.Choropleth(
                    geo_data=geo,
                    data=df,
                    columns=["cod_municipio", "iraa_score"],
                    key_on="feature.properties.DPTO_CCDGO",
                    fill_color="RdYlGn_r",
                    fill_opacity=0.75,
                    line_opacity=0.5,
                    legend_name="IRCA",
                ).add_to(m)
                folium_static(m, height=460)
            except ImportError:
                _mapa_fallback(df_vis)
        else:
            _mapa_fallback(df_vis)

    with col_panel:
        st.subheader("Detalle municipal")
        municipio_sel = st.selectbox(
            "Seleccionar municipio",
            df_vis.sort_values("iraa_score", ascending=False)["municipio"].tolist(),
            label_visibility="collapsed",
        )
        if municipio_sel:
            row = df_vis[df_vis["municipio"] == municipio_sel].iloc[0]
            _panel_detalle(row)

    st.divider()

    # ──── TABLA ────
    st.subheader(f"Tabla de municipios ({len(df_vis)} mostrados)")

    if df_vis["estado_confianza"].str.contains("Baja").any():
        n_baja = (df_vis["estado_confianza"] == "Baja - validación requerida").sum()
        st.markdown(
            f'<div class="advertencia-baja">⚠️ <strong>{n_baja} municipio(s)</strong> con '
            f'confianza baja: pueden reflejar subregistro de eventos en UNGRD.</div>',
            unsafe_allow_html=True,
        )

    col_tabla = ["municipio", "iraa_score", "nivel_riesgo",
                 "camas_por_1000_hab", "total_eventos", "severidad_vial",
                 "estado_confianza", "recomendacion"]

    df_show = df_vis[col_tabla].copy()
    df_show["iraa_score"] = df_show["iraa_score"].round(3)
    df_show["camas_por_1000_hab"] = df_show["camas_por_1000_hab"].round(2)
    df_show["severidad_vial"] = df_show["severidad_vial"].round(2)
    df_show.rename(columns={
        "municipio":         "Municipio",
        "iraa_score":        "IRCA",
        "nivel_riesgo":      "Nivel",
        "camas_por_1000_hab":"Camas/1000 hab",
        "total_eventos":     "Eventos",
        "severidad_vial":    "Severidad vial",
        "estado_confianza":  "Confianza",
        "recomendacion":     "Recomendación",
    }, inplace=True)

    st.dataframe(
        df_show.sort_values("IRCA", ascending=False),
        use_container_width=True,
        hide_index=True,
        column_config={
            "IRCA": st.column_config.ProgressColumn(
                "IRCA", min_value=0, max_value=1, format="%.3f"
            ),
            "Nivel": st.column_config.TextColumn("Nivel"),
        },
    )

    # Descarga CSV
    st.download_button(
        "⬇️ Descargar CSV filtrado",
        data=df_vis.to_csv(index=False, encoding="utf-8-sig"),
        file_name="rutavital_filtrado.csv",
        mime="text/csv",
    )


def _mapa_fallback(df_vis):
    """Mapa simplificado con scatter_chart cuando no hay GeoJSON o Folium."""
    st.info(
        "ℹ️ Para el mapa coroplético completo: instala folium + streamlit-folium "
        "y coloca choco_municipios.geojson en la carpeta data/. "
        "Mostrando visualización de burbujas."
    )
    # Coordenadas aproximadas de municipios del Chocó para demo
    COORDS = {
        27001: (5.694, -76.659), 27006: (8.514, -77.011), 27025: (6.044, -76.953),
        27050: (5.750, -76.543), 27073: (5.560, -76.393), 27075: (6.221, -77.395),
        27077: (5.256, -77.049), 27086: (7.218, -76.828), 27099: (5.498, -76.701),
        27135: (5.021, -76.809), 27150: (7.384, -77.209), 27160: (5.356, -76.432),
        27205: (5.099, -76.647), 27245: (5.916, -76.155), 27250: (4.738, -77.059),
        27361: (5.168, -76.698), 27372: (7.105, -77.766), 27413: (5.556, -76.531),
        27425: (5.844, -76.723), 27430: (5.424, -76.989), 27450: (4.906, -76.757),
        27491: (4.950, -76.607), 27495: (5.705, -77.277), 27580: (4.980, -76.528),
        27600: (5.388, -76.618), 27615: (7.444, -77.117), 27660: (5.038, -76.279),
        27745: (4.660, -76.625), 27787: (5.271, -76.567), 27800: (8.043, -76.936),
        27810: (5.074, -76.550),
    }
    df_m = df_vis.copy()
    df_m["lat"] = df_m["cod_municipio"].map(lambda c: COORDS.get(c, (5.5, -76.8))[0])
    df_m["lon"] = df_m["cod_municipio"].map(lambda c: COORDS.get(c, (5.5, -76.8))[1])
    df_m["size"] = (df_m["iraa_score"] * 500 + 50).clip(50, 550)
    st.map(df_m.rename(columns={"lat":"latitude","lon":"longitude"}),
           size="size", color=None, zoom=7)


def _panel_detalle(row):
    """Panel lateral con desglose completo del municipio seleccionado."""
    st.markdown(f"### {row['municipio']}")
    nivel = str(row["nivel_riesgo"])
    st.markdown(badge_riesgo(nivel), unsafe_allow_html=True)
    st.markdown("")

    if str(row.get("estado_confianza", "")) == "Baja - validación requerida":
        st.markdown(
            '<div class="advertencia-baja">⚠️ Confianza baja – puede reflejar subregistro</div>',
            unsafe_allow_html=True,
        )

    st.metric("IRCA", f"{row['iraa_score']:.3f}")

    st.markdown("**Percentiles del índice**")
    cols = st.columns(3)
    cols[0].metric("Vulnerab. sanitaria", f"{row['pctl_vuln_salud']:.2f}")
    cols[1].metric("Exposición histórica", f"{row['pctl_exposicion']:.2f}")
    cols[2].metric("Severidad vial", f"{row['pctl_severidad']:.2f}")

    st.markdown("**Datos base**")
    st.markdown(f"- Población: **{int(row['poblacion']):,}** {'*(imputada)*' if row['poblacion_imputada'] else ''}")
    st.markdown(f"- Camas activas: **{int(row['camas_totales'])}**")
    st.markdown(f"- Camas / 1.000 hab: **{row['camas_por_1000_hab']:.2f}**")
    st.markdown(f"- Eventos UNGRD: **{int(row['total_eventos'])}**")
    st.markdown(f"- Severidad vial promedio: **{row['severidad_vial']:.1f}**")

    st.markdown("**Recomendación operativa**")
    color_rec = {
        "Crítico": "#fde8e8", "Alto": "#fef3e2",
        "Medio":   "#fff8e1", "Bajo": "#e8f5e9",
    }.get(nivel, "#f5f5f5")
    st.markdown(
        f'<div style="background:{color_rec};padding:10px 14px;border-radius:8px;'
        f'font-size:13px;line-height:1.5">{row["recomendacion"]}</div>',
        unsafe_allow_html=True,
    )


if __name__ == "__main__":
    main()
