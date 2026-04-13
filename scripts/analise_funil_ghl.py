#!/usr/bin/env python3
"""
Análise completa de funil — GoHighLevel API v2
Coleta oportunidades de todos os pipelines e gera relatório.
"""
import requests
import json
import csv
import os
from datetime import datetime, timezone
from collections import defaultdict
import time

API_KEY = "pit-84405c2d-f89b-4f5c-8a00-8f6619d68252"
LOCATION_ID = "DlN4Ua95aZZCaR8qA5Nh"
BASE = "https://services.leadconnectorhq.com"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Version": "2021-07-28",
    "Content-Type": "application/json",
}

NOW = datetime.now(timezone.utc)
DATA_HOJE = NOW.strftime("%Y-%m-%d")


def api_get(endpoint, params=None, retries=3):
    """GET com retry automático."""
    url = f"{BASE}{endpoint}"
    for attempt in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, params=params, timeout=30)
            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After", 5))
                print(f"  Rate limit, aguardando {wait}s...")
                time.sleep(wait)
                continue
            if r.status_code == 200:
                return r.json()
            print(f"  API {r.status_code}: {r.text[:200]}")
            return None
        except Exception as e:
            print(f"  Erro: {e}")
            if attempt < retries - 1:
                time.sleep(2)
    return None


def fetch_pipelines():
    """Busca todos os pipelines."""
    data = api_get(f"/opportunities/pipelines", {"locationId": LOCATION_ID})
    return data.get("pipelines", []) if data else []


def fetch_opportunities(pipeline_id):
    """Busca todas as oportunidades de um pipeline com paginação."""
    all_opps = []
    params = {
        "location_id": LOCATION_ID,
        "pipeline_id": pipeline_id,
        "limit": 100,
    }

    # GHL v2 search endpoint
    page = 1
    while True:
        params["page"] = page
        data = api_get("/opportunities/search", params)
        if not data:
            break
        opps = data.get("opportunities", [])
        if not opps:
            break
        all_opps.extend(opps)
        meta = data.get("meta", {})
        total = meta.get("total", 0)
        if len(all_opps) >= total:
            break
        page += 1
        time.sleep(0.3)  # Respeitar rate limit

    return all_opps


def parse_date(date_str):
    """Parse ISO date string."""
    if not date_str:
        return None
    try:
        if date_str.endswith("Z"):
            date_str = date_str[:-1] + "+00:00"
        return datetime.fromisoformat(date_str)
    except:
        return None


def days_between(d1, d2):
    """Dias entre duas datas."""
    if not d1 or not d2:
        return None
    return abs((d2 - d1).total_seconds()) / 86400


def analyze_pipeline(pipeline, opportunities):
    """Analisa um pipeline completo."""
    stages = sorted(pipeline["stages"], key=lambda s: s["position"])
    stage_map = {s["id"]: s["name"] for s in stages}
    stage_order = [s["id"] for s in stages]

    result = {
        "name": pipeline["name"],
        "total_opps": len(opportunities),
        "stages": [],
        "sources": defaultdict(lambda: {"total": 0, "won": 0, "lost": 0, "open": 0, "monetary": 0}),
        "time_in_pipeline": [],
        "status_counts": {"open": 0, "won": 0, "lost": 0, "abandoned": 0},
    }

    # Contar por stage
    stage_counts = defaultdict(lambda: {"current": 0, "won": 0, "lost": 0, "open": 0, "days_list": []})

    for opp in opportunities:
        stage_id = opp.get("pipelineStageId", "")
        status = opp.get("status", "open")
        source = opp.get("source", "") or "Sem origem"
        monetary = float(opp.get("monetaryValue", 0) or 0)
        created = parse_date(opp.get("createdAt"))
        updated = parse_date(opp.get("lastStatusChangeAt") or opp.get("updatedAt"))

        # Status
        if status == "won":
            result["status_counts"]["won"] += 1
        elif status == "lost":
            result["status_counts"]["lost"] += 1
        elif status == "abandoned":
            result["status_counts"]["abandoned"] += 1
        else:
            result["status_counts"]["open"] += 1

        # Stage count
        stage_counts[stage_id]["current"] += 1
        if status == "won":
            stage_counts[stage_id]["won"] += 1
        elif status == "lost":
            stage_counts[stage_id]["lost"] += 1
        else:
            stage_counts[stage_id]["open"] += 1

        # Tempo no pipeline
        if created and updated:
            days = days_between(created, updated)
            if days is not None:
                stage_counts[stage_id]["days_list"].append(days)
                result["time_in_pipeline"].append(days)

        # Source
        result["sources"][source]["total"] += 1
        if status == "won":
            result["sources"][source]["won"] += 1
            result["sources"][source]["monetary"] += monetary
        elif status == "lost":
            result["sources"][source]["lost"] += 1
        else:
            result["sources"][source]["open"] += 1

    # Montar dados de stages na ordem correta
    for sid in stage_order:
        name = stage_map.get(sid, sid)
        sc = stage_counts[sid]
        days_list = sc["days_list"]

        avg_days = sum(days_list) / len(days_list) if days_list else 0
        median_days = sorted(days_list)[len(days_list) // 2] if days_list else 0
        max_days = max(days_list) if days_list else 0

        result["stages"].append({
            "id": sid,
            "name": name,
            "current": sc["current"],
            "won": sc["won"],
            "lost": sc["lost"],
            "open": sc["open"],
            "avg_days": round(avg_days, 1),
            "median_days": round(median_days, 1),
            "max_days": round(max_days, 1),
        })

    return result


def format_funnel_ascii(stages, total):
    """Gera funil ASCII."""
    lines = []
    max_width = 50
    for s in stages:
        if total == 0:
            pct = 0
        else:
            pct = (s["current"] / total) * 100
        bar_len = int((s["current"] / max(total, 1)) * max_width)
        bar = "█" * bar_len
        lines.append(f"  {s['name']:.<30s} {bar} {s['current']:>4d} ({pct:5.1f}%)")
    return "\n".join(lines)


def format_report(all_results):
    """Formata relatório completo."""
    report = []
    report.append("=" * 70)
    report.append(f"  RELATÓRIO DE ANÁLISE DE FUNIL — {DATA_HOJE}")
    report.append(f"  GoHighLevel — Location: {LOCATION_ID}")
    report.append("=" * 70)

    critical_points = []

    for result in all_results:
        report.append("")
        report.append("─" * 70)
        report.append(f"  PIPELINE: {result['name']}")
        report.append(f"  Total de oportunidades: {result['total_opps']}")
        sc = result["status_counts"]
        report.append(f"  Won: {sc['won']} | Lost: {sc['lost']} | Open: {sc['open']} | Abandoned: {sc['abandoned']}")

        if result["total_opps"] > 0:
            win_rate = (sc["won"] / result["total_opps"]) * 100
            report.append(f"  Taxa de conversão geral: {win_rate:.1f}%")
        report.append("─" * 70)

        # 3A. Tempo médio por etapa
        report.append("")
        report.append("  ┌─ TEMPO MÉDIO POR ETAPA")
        report.append("  │")
        report.append(f"  │ {'Etapa':<30s} {'Média':>8s} {'Mediana':>8s} {'Máximo':>8s} {'Qtd':>5s}")
        report.append(f"  │ {'─'*30} {'─'*8} {'─'*8} {'─'*8} {'─'*5}")

        for s in result["stages"]:
            alert = " ⚠️" if s["avg_days"] > 7 else ""
            report.append(f"  │ {s['name']:<30s} {s['avg_days']:>7.1f}d {s['median_days']:>7.1f}d {s['max_days']:>7.1f}d {s['current']:>5d}{alert}")
            if s["avg_days"] > 7 and s["current"] > 2:
                critical_points.append(f"[{result['name']}] Stage '{s['name']}' com tempo médio de {s['avg_days']:.1f} dias (>{'>'}7d)")
        report.append("  └─")

        # 3B. Taxa de conversão por etapa + funil ASCII
        report.append("")
        report.append("  ┌─ FUNIL DE CONVERSÃO")
        report.append("  │")
        report.append(format_funnel_ascii(result["stages"], result["total_opps"]))
        report.append("  │")

        # Maior ponto de sangramento
        max_lost_stage = None
        max_lost_pct = 0
        for s in result["stages"]:
            if s["current"] > 0:
                lost_pct = (s["lost"] / s["current"]) * 100
                if lost_pct > max_lost_pct:
                    max_lost_pct = lost_pct
                    max_lost_stage = s["name"]

        if max_lost_stage:
            report.append(f"  │ 🩸 Maior sangramento: '{max_lost_stage}' — {max_lost_pct:.1f}% de perda")
            if max_lost_pct > 30:
                critical_points.append(f"[{result['name']}] Sangramento em '{max_lost_stage}': {max_lost_pct:.1f}% dos leads são perdidos nesta etapa")
        report.append("  └─")

        # 3C. Origem x Conversão
        report.append("")
        report.append("  ┌─ ORIGEM × CONVERSÃO")
        report.append("  │")
        report.append(f"  │ {'Origem':<30s} {'Total':>6s} {'Won':>5s} {'Lost':>5s} {'%Fech':>7s} {'Valor':>12s}")
        report.append(f"  │ {'─'*30} {'─'*6} {'─'*5} {'─'*5} {'─'*7} {'─'*12}")

        sources_sorted = sorted(result["sources"].items(), key=lambda x: x[1]["won"], reverse=True)
        for source, data in sources_sorted:
            total = data["total"]
            won = data["won"]
            pct = (won / total * 100) if total > 0 else 0
            valor = f"R$ {data['monetary']:,.2f}" if data["monetary"] > 0 else "—"
            report.append(f"  │ {source:<30s} {total:>6d} {won:>5d} {data['lost']:>5d} {pct:>6.1f}% {valor:>12s}")
        report.append("  └─")

        # Pipeline time stats
        if result["time_in_pipeline"]:
            avg_total = sum(result["time_in_pipeline"]) / len(result["time_in_pipeline"])
            report.append("")
            report.append(f"  ⏱️  Tempo médio no pipeline: {avg_total:.1f} dias")

    # Resumo executivo
    report.append("")
    report.append("=" * 70)
    report.append("  RESUMO EXECUTIVO — PONTOS CRÍTICOS")
    report.append("=" * 70)

    if critical_points:
        for i, point in enumerate(critical_points[:10], 1):
            report.append(f"  {i}. {point}")
    else:
        report.append("  Nenhum ponto crítico identificado com os dados disponíveis.")

    report.append("")
    report.append("=" * 70)

    return "\n".join(report)


def save_csv(all_results, all_opps_raw, filename):
    """Salva dados brutos em CSV."""
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "pipeline", "opp_id", "contact_name", "stage", "status",
            "source", "monetary_value", "created_at", "updated_at",
            "days_in_pipeline"
        ])

        for pipeline_name, opps in all_opps_raw:
            for opp in opps:
                created = parse_date(opp.get("createdAt"))
                updated = parse_date(opp.get("lastStatusChangeAt") or opp.get("updatedAt"))
                days = days_between(created, updated) if created and updated else ""

                writer.writerow([
                    pipeline_name,
                    opp.get("id", ""),
                    opp.get("name", opp.get("contactName", "")),
                    opp.get("pipelineStageId", ""),
                    opp.get("status", ""),
                    opp.get("source", ""),
                    opp.get("monetaryValue", 0),
                    opp.get("createdAt", ""),
                    opp.get("updatedAt", ""),
                    f"{days:.1f}" if days else "",
                ])


def main():
    print(f"\n🔍 Análise de Funil GHL — {DATA_HOJE}")
    print("─" * 50)

    # 1. Buscar pipelines
    print("\n📋 Buscando pipelines...")
    pipelines = fetch_pipelines()
    if not pipelines:
        print("❌ Nenhum pipeline encontrado.")
        return

    print(f"   Encontrados: {len(pipelines)} pipelines")

    all_results = []
    all_opps_raw = []

    # 2. Buscar oportunidades de cada pipeline
    for pl in pipelines:
        print(f"\n📊 Pipeline: {pl['name']}")
        print(f"   Buscando oportunidades...")

        opps = fetch_opportunities(pl["id"])
        print(f"   Encontradas: {len(opps)} oportunidades")

        if opps:
            result = analyze_pipeline(pl, opps)
            all_results.append(result)
            all_opps_raw.append((pl["name"], opps))

    # 3. Gerar relatório
    print("\n📝 Gerando relatório...")
    report = format_report(all_results)

    # 4. Salvar arquivos
    report_file = f"/Users/lucassilva/dashboard-comercial/relatorio_funil_{DATA_HOJE}.txt"
    csv_file = f"/Users/lucassilva/dashboard-comercial/dados_brutos_{DATA_HOJE}.csv"

    with open(report_file, "w", encoding="utf-8") as f:
        f.write(report)

    save_csv(all_results, all_opps_raw, csv_file)

    print(f"\n✅ Relatório salvo: {report_file}")
    print(f"✅ Dados brutos: {csv_file}")

    # 5. Mostrar no terminal
    print("\n" + report)


if __name__ == "__main__":
    main()
