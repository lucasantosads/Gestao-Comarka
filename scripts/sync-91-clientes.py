"""
Sincronizar 91 clientes da planilha com Supabase.
Executar: python3 scripts/sync-91-clientes.py
"""
import requests, json, time

SB = "https://ogfnojbbvumujzfklkhh.supabase.co/rest/v1"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nZm5vamJidnVtdWp6Zmtsa2hoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDMyMzMwOCwiZXhwIjoyMDg5ODk5MzA4fQ.EFCFnNP7bt1KuT2KcDp-aF0_zDOvblNkcrfw8-5zVNk"
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=representation"}
HM = {**H, "Prefer": "resolution=merge-duplicates,return=representation"}

# All 91 clients
CLIENTES = [
    # id, nome, plataforma, valor, ltv, closer, contrato, dia, status_fin, categoria, fechamento, obs, pagamentos[(mes,valor,dia)]
    (1,"ARAUJO E SAMPAIO","META",2500,12,"Lucas","mensal",1,"ativo","Advogados",None,None,[(1,2500,None),(2,2500,1),(3,2500,1),(4,2500,31)]),
    (2,"DARCI ECCEL","META",1500,3,"Mariana","12M",1,"ativo","Advogados","2026-01-01","30/01/26 - 30/01/27",[(2,1500,None),(3,1500,2),(4,1500,1)]),
    (3,"ROSANA E IVO","META",1700,1,"Mariana","3M",4,"ativo","Advogados","2026-02-01","3M - 25/02 -25/05",[(3,1700,4)]),
    (4,"MARQUES ADVOGADO","META",1500,16,"Lucas","mensal",5,"ativo","Advogados",None,None,[(1,1500,8),(2,1500,5),(3,1500,6)]),
    (5,"CIRILLO ADVOCACIA","META",2500,4,"Lucas","6M",5,"ativo","Advogados",None,"Inicio 10/10 até 10/04 - 6M",[(1,2500,27)]),
    (6,"RYAN PYRRHO","META",1800,10,"Lucas","mensal",5,"ativo","Advogados",None,None,[(1,1800,8),(2,1800,None),(3,1800,10)]),
    (7,"MACHADO E COSTA","META",2500,1,"Lucas","3M",5,"ativo","Advogados",None,"3 MESES",[(1,2500,9),(2,2500,None),(3,2500,None)]),
    (8,"JUCIMARCIA","META",1500,8,"Lucas","mensal",5,"ativo","Advogados",None,None,[(1,1500,None),(3,1500,14)]),
    (9,"JULIA REIS DANTAS","META",2000,5,"Lucas","mensal",5,"ativo","Advogados",None,None,[(1,2000,None),(2,2000,6),(3,2000,3)]),
    (10,"KAIRO RODRIGUES","META",3000,2,"Lucas","mensal",5,"ativo","Advogados",None,None,[(1,3000,None),(2,3000,27)]),
    (11,"ISABELLA GARCIA MENEZES","META",1400,1,"Mariana","1M",5,"ativo","Advogados","2026-02-01","1M",[(3,1400,3)]),
    (12,"CLEITON SOUZA","META",1500,5,"Lucas","mensal",5,"ativo","Advogados",None,None,[(1,1500,None),(2,1500,5),(3,1500,16)]),
    (13,"FG TREINAMENTOS / EMILY","META",2000,2,"Lucas","mensal",5,"ativo","Advogados",None,"05/02 - 05/05",[(2,2000,4),(3,2000,5)]),
    (14,"HAILTON - CUNHA E NOGUEIRA","META",2000,2,"Lucas","3M",5,"ativo","Advogados",None,"3M | 05/02 - 05/05",[(2,2000,5),(3,2000,5)]),
    (15,"RODRIGO MELO","META",2497,1,"Lucas","3M",10,"ativo","Advogados","2026-02-01","3M - 25/02 -25/05",[(2,2497,25)]),
    (16,"CLAUDINALLY JUSTULA","META",1200,1,"Mariana","mensal",10,"ativo","Advogados","2026-02-01",None,[(2,1200,27)]),
    (17,"ANA CAROLINA (CAV)","META",1800,2,"Lucas","mensal",10,"ativo","Advogados","2026-03-01",None,[(3,1800,17)]),
    (18,"MATHEUS CAMPELO","META",1500,1,"Lucas","mensal",10,"ativo","Advogados","2026-03-01",None,[(3,1500,10)]),
    (19,"LIPORACI ADV","META",2000,1,"Rogério","mensal",10,"ativo","Advogados","2026-03-01",None,[(3,1500,16)]),
    (20,"CAMILA FERNANDES","META",1500,1,"Mariana","3M",10,"ativo","Advogados","2026-03-01","3M",[]),
    (21,"ARTHUR","META",1800,2,"Rogério","mensal",10,"ativo","Advogados","2026-01-01","30/01- 30/04",[(1,1500,30),(3,1800,30)]),
    (22,"ADRIZZYA/ ARAUJO E CABRAL","META",1500,3,"Lucas","mensal",10,"ativo","Advogados",None,None,[(1,1500,None),(2,1500,9),(3,1500,10)]),
    (23,"JAU PIRES","GOOGLE",1500,21,"Lucas","mensal",10,"ativo","Advogados",None,None,[(1,1500,12),(2,1500,10),(3,1500,10)]),
    (24,"GONÇALVES E BATISTA","META",1800,8,"Lucas","mensal",10,"ativo","Advogados",None,None,[(1,1800,10),(2,1800,10),(3,1800,10)]),
    (25,"VIANA E BRAVIN","META",1500,1,"Rogério","mensal",10,"ativo","Advogados","2026-03-01","2- 1800 3- 2000",[(3,1500,27)]),
    (26,"MSL ADVOGADOS","META",2200,6,"Lucas","mensal",10,"ativo","Advogados",None,None,[(1,2200,13),(2,2200,10),(3,2200,10)]),
    (27,"FABIO SANTOS","META",2000,1,"Mariana","3M",10,"ativo","Advogados","2026-02-01","3M - 25/2 - 25/5",[(2,2000,25)]),
    (28,"PEDRO - CERQUEIRA E SAMPAIO","META",1500,1,"Lucas","mensal",10,"ativo","Advogados","2026-03-01",None,[(3,1500,14)]),
    (29,"GABRIEL E LUANA - TELES","META",1791,3,"Mariana","12M",10,"ativo","Advogados","2026-01-01","20/01/26 - 20/01/27",[(1,1791,20),(2,1791,10),(3,1791,10)]),
    (30,"ANA FLAVIA RIBEIRO - AFR","META",1800,1,"Rogério","mensal",15,"ativo","Advogados","2026-03-01",None,[(3,1500,18)]),
    (31,"DIEGO GONÇALVES","META",1500,1,"Rogério","mensal",15,"ativo","Advogados","2026-03-01",None,[(3,1500,18)]),
    (32,"MARIANNE ANDRADE","META",1500,7,"Lucas","mensal",15,"ativo","Advogados",None,None,[(1,1500,13),(2,1500,20),(3,1500,17)]),
    (33,"RICARDO TRANCOSO","META",1500,1,"Rogério","mensal",15,"ativo","Advogados","2026-03-01","terceiro mes 2k",[(3,1500,23)]),
    (34,"KAYNÃ MOTA","META",1400,21,"Lucas","mensal",15,"ativo","Advogados",None,None,[(1,1400,18),(2,1400,17),(3,1400,18)]),
    (35,"MSC ADVOGADOS","META",1500,9,"Lucas","mensal",15,"ativo","Advogados",None,None,[(1,1500,28),(2,3000,26)]),
    (36,"PEDRO HENRIQUE","META",1500,16,"Lucas","mensal",15,"ativo","Advogados",None,None,[]),
    (37,"EDIMEIA BEATRIZ","META",2000,1,"Lucas","mensal",20,"ativo","Advogados","2026-03-01",None,[(3,2000,12)]),
    (38,"ABREU E ZANOTTO","META",2000,3,"Lucas","mensal",20,"ativo","Advogados",None,None,[(1,2000,20),(2,2000,25)]),
    (39,"GABI CANUTO","META",2300,10,"Lucas","mensal",20,"ativo","Advogados",None,None,[(1,2300,16),(2,2300,None)]),
    (40,"ANTONIO JORGE","META",1500,11,"Lucas","mensal",20,"ativo","Advogados",None,None,[(1,1500,None),(2,1500,None)]),
    (41,"JOSIAS MAIA","META",2000,10,"Lucas","mensal",20,"ativo","Advogados",None,"retorna 20/1",[(1,2000,25),(2,2000,24),(3,2000,20)]),
    (42,"MARTINI ADVOCACIA","META",1000,5,"Lucas","3M",20,"ativo","Advogados",None,"1K POR 3M",[(1,1000,27),(2,1000,20)]),
    (43,"JOÃO GOBBO","META",1800,5,"Lucas","mensal",20,"ativo","Advogados",None,None,[(1,1800,20),(2,1800,20),(3,1800,18)]),
    (44,"RIBEIRO COSTA","META",3000,2,"Lucas","3M",20,"ativo","Advogados",None,"3M - 28/01/26 - 28/04",[(1,3000,28),(2,3000,None)]),
    (45,"RENATO TORRES","META",1500,2,"Mariana","3M",20,"ativo","Advogados","2026-01-01","3M 19/01 ATE 19/04",[(1,1500,19),(2,1500,None)]),
    (46,"TEM DIREITO/MARTINS","META",1500,3,"Mariana","3M",20,"ativo","Advogados","2026-01-01","3 MESES",[(1,1500,30),(2,1500,20),(3,1500,20)]),
    (47,"LARISSA CARVALHO SANTANA","META",1700,3,"Rogério","3M",20,"ativo","Advogados","2026-01-01","3 MESES",[(2,1700,4),(3,1700,24)]),
    (48,"CAMILA VIEIRA SOLTO - REDE DOC","META",2000,2,"Lucas","mensal",20,"ativo","Advogados",None,None,[(2,2000,13),(3,2000,30)]),
    (49,"JHULLIANE","META",2000,2,"Mariana","3M",20,"ativo","Advogados","2026-01-01","3M 20/01 - 20/04",[(1,2000,20),(2,2000,23)]),
    (50,"CARLOS VILA REAL","META",1800,1,"Mariana","mensal",20,"ativo","Advogados","2026-03-01",None,[(3,1800,20)]),
    (51,"ROGERIO E ARIVALDO MARQUES E MELO","META",1600,3,"Lucas","mensal",20,"ativo","Advogados",None,None,[(1,1600,28),(2,1600,20),(3,1600,20)]),
    (52,"FABIANA","META",1500,1,"Mariana","mensal",20,"ativo","Advogados","2026-02-01",None,[(2,1500,11)]),
    (53,"EVARISTO E VIANA","META",1500,4,"Lucas","mensal",20,"ativo","Advogados","2026-03-01",None,[(1,1500,20),(3,1500,25)]),
    (54,"FERNANDO MIGUEL","META",1800,1,"Rogério","3M",20,"ativo","Advogados","2025-03-01","3M- 1500, 1800, 2000",[(3,1500,23)]),
    (55,"JAINE - OLIVEIRA E PERES","META",1500,3,"Mariana","mensal",20,"ativo","Advogados","2026-01-01","2K dia 10 + 2x 1.5k (05/01 ate 05/04)",[(1,2000,9),(2,1500,20),(3,1500,20)]),
    (56,"MARCOS VINICIUS","META",2000,1,"Lucas","mensal",20,"ativo","Advogados","2026-03-01",None,[(3,2000,19)]),
    (57,"ALEXANDRE CARUSO / MMS SOLUCOES","META",3000,3,"Lucas","mensal",20,"ativo","Advogados","2026-02-01",None,[(2,3000,20),(3,3000,20)]),
    (58,"UENDERSON/NICOLAS","META",1500,2,"Mariana","mensal",20,"ativo","Advogados","2026-02-01",None,[(2,1500,20),(3,1500,26)]),
    (59,"CANDIDA BONFIM","META",1500,1,"Lucas","mensal",20,"ativo","Advogados","2026-02-01",None,[(2,1500,25)]),
    (60,"MICHELLE - ALMEIDA E CORREA","META",2500,4,"Lucas","mensal",23,"ativo","Advogados",None,None,[(1,2500,23),(2,2500,10),(3,2500,10)]),
    (61,"EDUARDO PERLETTO","META",2000,2,"Lucas","3M",25,"ativo","Advogados","2026-02-01","3M - 25/02 -25/05",[(3,4000,None)]),
    (62,"VIVIANE BARROS","META",1500,9,"Lucas","mensal",27,"ativo","Advogados",None,None,[(1,1500,30),(2,1500,None)]),
    (63,"MARLON CHIQUITI","META",4000,7,"Lucas","mensal",28,"ativo","Advogados",None,None,[(1,4000,28),(2,4000,28)]),
    (64,"RITA DE CASSIA ALMEIDA","META",2000,3,"Mariana","6M",30,"ativo","Advogados","2026-01-01","6M 05/01 ate 05/07 - 12K em 12x ASAAS",[(1,1000,30),(2,1000,None),(3,1000,3)]),
    (65,"MAX WEBER","META",1500,1,"Mariana","mensal",30,"ativo","Advogados","2026-03-01",None,[]),
    (66,"BRUNO DE MELO","META",1600,1,"Lucas","mensal",None,"ativo","Advogados","2026-03-01",None,[(3,1600,30)]),
    (67,"TASSIA","META",1500,1,"Rogério","mensal",None,"ativo","Advogados","2026-03-01",None,[(3,500,30)]),
    (68,"MARIANA MAGALHAES","META",1500,1,"Mariana","mensal",None,"ativo","Advogados","2026-03-01",None,[(3,1500,30)]),
    (69,"IGOR COELHO","META",1800,1,"Rogério","mensal",None,"ativo","Advogados","2026-03-01",None,[(3,1800,31)]),
    (70,"RICARDO JULIANO","META",1500,1,"Lucas","mensal",None,"ativo","Advogados","2026-03-01",None,[(3,500,31)]),
    (71,"ADEMIR","META",1500,1,"Lucas","mensal",None,"ativo","Advogados",None,None,[]),
    # Negócio Local
    (72,"Btu ar condicionado","GOOGLE",1000,10,None,"mensal",10,"ativo","Negócio Local",None,None,[(1,1000,27)]),
    # MDS
    (73,"Joyce campodonio","GOOGLE",500,28,None,"mensal",30,"ativo","MDS",None,None,[(1,3000,None),(2,3500,None),(3,4000,30)]),
    (74,"Roberta Borges","META",500,11,None,"mensal",30,"ativo","MDS",None,None,[]),
    (75,"Eugênio Ramalho","GOOGLE",500,29,None,"mensal",30,"ativo","MDS",None,None,[]),
    (76,"Jeanne","GOOGLE",500,5,None,"mensal",30,"ativo","MDS",None,None,[]),
    (77,"Leonardo albuquerque","META",500,4,None,"mensal",30,"ativo","MDS",None,None,[]),
    (78,"Thiago Araujo","META",500,4,None,"mensal",30,"ativo","MDS",None,None,[]),
    (79,"Oral Unic","META",500,3,None,"mensal",30,"ativo","MDS",None,None,[]),
    (80,"Marcio Freitas","META",500,2,None,"mensal",30,"ativo","MDS",None,None,[]),
    (81,"Gustavo Freitas","META",500,1,None,"mensal",None,"ativo","MDS",None,None,[]),
    # Pausados, Integral, Parceria
    (82,"LILIAN GOULART","META",2000,1,"Lucas","mensal",20,"pausado","Advogados",None,"PAUSADO",[(2,2000,11)]),
    (83,"MONIQUE","META",2000,8,None,"mensal",20,"pausado","Advogados",None,None,[(3,1000,31)]),
    (84,"JOHNATA FÉLIX","META",2300,1,None,"3M",20,"pausado","Advogados",None,"3M - 30/01 PAUSADO Faltam 6k",[(1,1000,20)]),
    (85,"RODIVAN BORGES","META",1333,1,"Rogério","mensal",None,"pagou_integral","Advogados","2026-03-01","27/3 ATE 27/6",[(3,4000,27)]),
    (86,"RUTE E EVERTON","META",2500,1,"Mariana","3M",None,"pagou_integral","Advogados","2026-03-01","3M - 06/03 - 06/06",[(3,6493,1)]),
    (87,"JOMATTA SANTOS","META",2000,4,None,"mensal",None,"pagou_integral","Advogados",None,"12K PIX 12/11 - 12/05",[]),
    (88,"JULIANO","META",2100,4,None,"mensal",17,"pagou_integral","Advogados",None,"(13k cartao) Dia 17 conta stone",[]),
    (89,"FRANK DEERING","META",0,2,None,"mensal",20,"parceria","Advogados",None,None,[]),
    (90,"AQUINO ADV","META",0,5,None,"mensal",None,"parceria","Advogados",None,None,[]),
    (91,"BACELLAR E LUZ","META",0,14,None,"mensal",None,"parceria","Advogados",None,None,[]),
]

def main():
    stats = {"clientes_ok": 0, "clientes_inseridos": 0, "clientes_corrigidos": 0, "pag_ok": 0, "pag_inseridos": 0, "extras": []}

    # Get existing
    r = requests.get(f"{SB}/clientes_receita?select=id,nome", headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    existing = {c["nome"].upper(): c["id"] for c in r.json()}

    for num, nome, plat, valor, ltv, closer, contrato, dia, status_fin, cat, fech, obs, pagamentos in CLIENTES:
        nome_upper = nome.upper()

        # Check if exists
        cliente_id = existing.get(nome_upper)

        row = {
            "nome": nome, "plataforma": plat, "valor_mensal": valor,
            "ltv_meses": ltv, "closer": closer or None,
            "tipo_contrato": contrato, "dia_pagamento": dia,
            "status": "ativo", "status_financeiro": status_fin,
            "categoria": cat, "mes_fechamento": fech, "obs": obs,
        }

        if not cliente_id:
            # Insert
            r = requests.post(f"{SB}/clientes_receita", headers=H, json=row)
            if r.status_code in (200, 201):
                data = r.json()
                cliente_id = data[0]["id"] if isinstance(data, list) else data["id"]
                stats["clientes_inseridos"] += 1
            else:
                print(f"  ERR insert {nome}: {r.status_code} {r.text[:80]}")
                continue
        else:
            # Update
            r = requests.patch(f"{SB}/clientes_receita?nome=eq.{requests.utils.quote(nome)}", headers=H, json=row)
            if r.status_code in (200, 204):
                stats["clientes_corrigidos"] += 1
            else:
                stats["clientes_ok"] += 1

        # Pagamentos
        for mes, val, dia_pag in pagamentos:
            mes_ref = f"2026-{str(mes).zfill(2)}-01"
            pag_row = {
                "cliente_id": cliente_id, "mes_referencia": mes_ref,
                "valor_pago": val, "dia_pagamento": dia_pag, "status": "pago",
            }
            r = requests.post(f"{SB}/pagamentos_mensais?on_conflict=cliente_id,mes_referencia", headers=HM, json=pag_row)
            if r.status_code in (200, 201):
                stats["pag_inseridos"] += 1
            else:
                stats["pag_ok"] += 1
            time.sleep(0.02)

    # Check for extras in DB not in our list
    all_names = {c[1].upper() for c in CLIENTES}
    for nome_db in existing:
        if nome_db not in all_names:
            stats["extras"].append(nome_db)

    print("\n=== RELATÓRIO ===")
    print(f"Clientes inseridos: {stats['clientes_inseridos']}")
    print(f"Clientes corrigidos: {stats['clientes_corrigidos']}")
    print(f"Clientes já OK: {stats['clientes_ok']}")
    print(f"Total processados: {stats['clientes_inseridos'] + stats['clientes_corrigidos'] + stats['clientes_ok']}")
    print(f"Pagamentos inseridos/atualizados: {stats['pag_inseridos']}")
    print(f"Pagamentos já existiam: {stats['pag_ok']}")
    if stats["extras"]:
        print(f"Clientes no DB mas NÃO na planilha ({len(stats['extras'])}): {', '.join(stats['extras'])}")
    print("=================")

if __name__ == "__main__":
    main()
