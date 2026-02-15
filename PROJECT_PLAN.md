# PROMPT PRE CLAUDE CODE: Slovenský AI Účtovný a Fakturačný Systém v3.0 (FINÁLNY)

## Skopíruj a vlož tento prompt do Claude Code:

---

Vytvor kompletný slovenský AI-first účtovný a fakturačný systém ako webovú aplikáciu v **Next.js 14 (App Router) + Supabase + Tailwind CSS**, nasaditeľnú na Vercel. Systém musí byť plne v slovenčine, právne a účtovne bezchybný podľa slovenskej legislatívy a použiteľný pre malé, stredné aj väčšie firmy (s.r.o., a.s., SZČO, družstvá).

### Relevantná legislatíva (systém musí byť v súlade s):
- Zákon č. 431/2002 Z.z. o účtovníctve
- Zákon č. 222/2004 Z.z. o DPH
- Zákon č. 595/2003 Z.z. o dani z príjmov
- Zákon č. 311/2001 Z.z. Zákonník práce
- Zákon č. 461/2003 Z.z. o sociálnom poistení
- Zákon č. 580/2004 Z.z. o zdravotnom poistení
- Zákon č. 18/2018 Z.z. o ochrane osobných údajov (GDPR)
- Zákon č. 215/2002 Z.z. o elektronickom podpise / eIDAS
- Zákon č. 289/2008 Z.z. o eKase
- Opatrenie MF SR č. 23054/2002-92 (postupy účtovania pre podnikateľov)
- Opatrenie MF SR č. 4455/2003-92 (postupy účtovania v JÚ)
- Nariadenie EÚ č. 952/2013 – Intrastat
- Smernica 2006/112/ES o DPH (OSS, reverse charge, trojstranný obchod)

---

## 1. FAKTURAČNÝ MODUL

### 1.1 Odosielané faktúry:
- Vytvorenie, editácia, klonovanie, stornovanie faktúr
- Automatické číslovanie faktúr (konfigurovateľný formát, napr. FA2025001, číselné rady podľa typu)
- Povinné náležitosti podľa §71-75 zákona o DPH:
  - Dodávateľ (obchodné meno, IČO, DIČ, IČ DPH, sídlo, bankový účet IBAN, BIC/SWIFT)
  - Odberateľ (obchodné meno, IČO, DIČ, IČ DPH, sídlo)
  - Dátum vystavenia, dátum dodania, dátum splatnosti
  - Jednotková cena, množstvo, merná jednotka, základ dane, sadzba DPH (23%, 19%, 5%, 0%, oslobodené – aktuálne platné sadzby!)
  - Celková suma s DPH aj bez DPH
  - Číslo faktúry, konštantný symbol, variabilný symbol, špecifický symbol
  - Slovný opis dôvodu oslobodenia od DPH (ak relevantné, §42-48)
- Generovanie PDF faktúr s logom firmy, pečiatkou, podpisom
- **QR kód PAY by square** (slovenský platobný štandard)
- Zálohové faktúry a ich vyúčtovanie (automatický odpočet zálohy)
- Dobropisy (opravné faktúry) – väzba na pôvodnú faktúru
- Proforma faktúry
- Faktúry v cudzej mene s kurzovým prepočtom (kurz ECB/NBS k dátumu dodania)
- Opakujúce sa faktúry (mesačné, štvrťročné, ročné – auto-generovanie)
- Hromadná fakturácia (vybrať viacero kontaktov, vygenerovať faktúry)
- Upomienky a penalizačné faktúry (úrok z omeškania podľa §369 Obchodného zákonníka)
- Faktúry s prenesením daňovej povinnosti (§69 ods. 12 – stavebníctvo, kovy, obilie, plodiny)
- Dodacie listy prepojené s faktúrami
- Cenové ponuky → konverzia na faktúru
- Objednávky prijaté → konverzia na faktúru

### 1.2 E-faktúra / EDI:
- Podpora formátu **UBL 2.1** a **ISDOC**
- Napojenie na systém **e-Faktúra Finančnej správy SR** (pripravená architektúra)
- Export/import vo formáte UBL XML
- **Peppol** príprava (pan-európska e-fakturácia)
- ZUGFeRD/Factur-X hybrid PDF (PDF s embedded XML)
- Automatická validácia e-faktúr

### 1.3 Prijaté faktúry:
- Manuálne zadávanie
- **OCR načítavanie z JPG, PNG, PDF** (viď modul OCR)
- Párované s bankovými výpismi
- Schvaľovací workflow (viacstupňový – fakturant → účtovník → konateľ)
- Automatické overenie dodávateľa (platiteľ DPH, insolvencia, sankčné zoznamy)
- Kontrola duplicity (rovnaké číslo + dodávateľ = varovanie)
- Lehoty na odpočet DPH (kontrola §51 ods. 2)

### 1.4 Databáza kontaktov:
- Register odberateľov a dodávateľov
- Automatické doplnenie údajov podľa IČO:
  - **ORSR** (Obchodný register SR)
  - **Živnostenský register**
  - **data.gov.sk / RPO** (Register právnických osôb)
  - **FinStat API** (voliteľné – finančné údaje)
- Overenie IČ DPH cez **VIES API** (systém EÚ)
- Overenie v **zozname platiteľov DPH** Finančnej správy SR
- Overenie v **zozname vymazaných platiteľov DPH**
- Overenie v **Registri partnerov verejného sektora (RPVS)**
- Overenie v **Insolvenčnom registri SR**
- Overenie v **sankčných zoznamoch EÚ** (protiprávne obchodovanie)
- História fakturácie na kontakt
- Tagging a kategorizácia kontaktov
- Kontaktné osoby pod firmou
- Kreditný limit na odberateľa

---

## 2. ÚČTOVNÝ MODUL (Podvojné účtovníctvo)

### 2.1 Účtový rozvrh:
- Prednastavený slovenský účtový rozvrh podľa Opatrenia MF SR č. 23054/2002-92:
  - Trieda 0 – Dlhodobý majetok
  - Trieda 1 – Zásoby
  - Trieda 2 – Finančné účty
  - Trieda 3 – Zúčtovacie vzťahy
  - Trieda 4 – Kapitálové účty a dlhodobé záväzky
  - Trieda 5 – Náklady
  - Trieda 6 – Výnosy
  - Trieda 7 – Závierkové a podsúvahové účty
- Syntetické aj analytické účty
- Možnosť pridávať vlastné analytické účty
- Import/export účtového rozvrhu (CSV, XLSX)
- Označenie účtov: daňový/nedaňový, aktívny/pasívny, výsledkový/súvahový
- Podsúvahové účty (trieda 7xx – evidencia prenajatého majetku, záruk atď.)

### 2.2 Účtovné zápisy:
- Účtovanie na stranu **Má dať / Dal**
- Automatické účtovanie faktúr (napr. 311/602+343, 501+343/321 atď.)
- Interné doklady (ID)
- Pokladničné doklady (PPD – príjmový, VPD – výdavkový)
- Bankové výpisy (BV)
- Účtovanie DPH (343 – DPH na vstupe/výstupe, rozdelenie podľa sadzieb)
- Kurzové rozdiely (563 – kurzová strata, 663 – kurzový zisk)
- Účtovanie odpisov (551/08x – účtovné, daňové zvlášť)
- Účtovanie na zákazky / strediská / projekty (analytická evidencia)
- Časové rozlíšenie:
  - 381 – Náklady budúcich období
  - 382 – Komplexné náklady budúcich období
  - 383 – Výdavky budúcich období
  - 384 – Výnosy budúcich období
  - 385 – Príjmy budúcich období
- Opravné položky:
  - 391 – Opravné položky k pohľadávkam (§20 ods. 14 ZDP – zákonné)
  - 559 – Tvorba a zúčtovanie opravných položiek
- Rezervy:
  - 323 – Krátkodobé rezervy
  - 451 – Rezervy zákonné
  - 459 – Ostatné rezervy
- Odpis pohľadávok (546/311)
- Dohadné účty:
  - 388 – Dohadné účty aktívne
  - 389 – Dohadné účty pasívne
- Účtovanie leasingu:
  - Finančný leasing podľa slovenských postupov účtovania
  - Operatívny leasing
  - Spätný leasing
- Storno účtovného zápisu (nie mazanie – nový opačný zápis)
- Automatický návrh účtovania od AI (viď AI modul)

### 2.3 Predkontácie:
- Prednastavené predkontácie pre bežné operácie:
  - Nákup materiálu: 501+343/321
  - Nákup služieb (telefón, internet, poradenstvo): 518+343/321
  - Nákup PHM: 501+343/321
  - Nájomné: 518+343/321
  - Energie: 502+343/321
  - Predaj tovaru: 311/604+343
  - Predaj služieb: 311/602+343
  - Mzdy: 521/331, 524/336, 525/336
  - Odpisy: 551/08x
  - Bankové poplatky: 568/221
  - Úroky prijaté: 221/662
  - Úroky zaplatené: 562/221
  - Pokladňa príjem: 211/xxx
  - Pokladňa výdaj: xxx/211
- Možnosť vytvárať vlastné predkontácie
- AI navrhuje predkontáciu na základe obsahu dokladu

### 2.4 Účtovné knihy:
- **Hlavná kniha** – obraty (MD/D) a zostatky všetkých účtov, filtrovanie podľa obdobia, strediska, zákazky
- **Účtovný denník** – chronologický záznam všetkých účtovných zápisov
- **Kniha pohľadávok** – evidencia neuhradených vydaných faktúr, aging report
- **Kniha záväzkov** – evidencia neuhradených prijatých faktúr, aging report
- **Pokladničná kniha** – evidencia hotovostných operácií (EUR + cudzia mena)
- **Kniha bankových výpisov** – prehľad importovaných a zaúčtovaných výpisov
- **Evidencia majetku** – dlhodobý hmotný/nehmotný majetok, karty majetku, odpisy, zaradenie/vyradenie
- **Kniha jázd** – evidencia jázd služobným/súkromným vozidlom (km, účel, trasa)
- **Podsúvahová evidencia** – prenajatý majetok, záruky, podmienené záväzky

### 2.5 Výkazy:
- **Súvaha (Bilancia)** – aktíva, pasíva podľa vzoru MF SR (Úč 1-01)
- **Výkaz ziskov a strát** – výnosy, náklady podľa vzoru MF SR (Úč 2-01)
- **Cash flow výkaz** (priama/nepriama metóda)
- **Obratová predvaha** (mesačná, štvrťročná, ročná) – kontrola MD = D
- **Saldokonto** (odberateľské, dodávateľské) s aging analýzou
- **Výkaz o vlastnom imaní** (zmeny vo vlastnom imaní za obdobie)
- Všetky výkazy s porovnaním predchádzajúce obdobie vs. aktuálne

---

## 3. JEDNODUCHÉ ÚČTOVNÍCTVO (pre SZČO)

### 3.1 Peňažný denník:
- Príjmy a výdavky (daňové / nedaňové)
- Členenie príjmov: predaj tovaru, predaj služieb, ostatné príjmy
- Členenie výdavkov: materiál, tovar, služby, mzdy, poistné, odpisy, ostatné
- Pohyby v pokladni a na bankovom účte
- Priebežné položky (prevody medzi pokladňou a bankou)
- Uzávierka peňažného denníka (ročná)

### 3.2 Pomocné knihy:
- Kniha pohľadávok
- Kniha záväzkov
- Pomocná kniha DPH
- Kniha dlhodobého majetku s odpismi
- Kniha zásob (ak relevantné)
- Kniha cenín
- Pokladničná kniha

### 3.3 Výkazy pre jednoduché účtovníctvo:
- **Výkaz o príjmoch a výdavkoch** podľa vzoru MF SR (Úč 1-01 JÚ)
- **Výkaz o majetku a záväzkoch** podľa vzoru MF SR (Úč 2-01 JÚ)
- Podklady pre daňové priznanie DPFO typ B

---

## 4. DAŇOVÉ MODULY

### 4.1 DPH – Daňové priznanie k DPH:
- Automatický výpočet DPH z účtovných zápisov / peňažného denníka
- Generovanie **XML súboru** podľa platnej XSD schémy Finančnej správy SR (dphdp_*.xsd)
- Podpora mesačného aj štvrťročného zdaňovacieho obdobia
- Výpočet vlastnej daňovej povinnosti / nadmerného odpočtu
- Koeficient DPH (pomerné odpočítanie §50)
- Podpora §69 ods. 12 – tuzemský prenos daňovej povinnosti (stavebníctvo, poľnohospodárske plodiny, kovy, elektronika)
- Podpora reverse charge (nadobudnutie z EÚ §11, §13)
- Podpora trojstranného obchodu (§45)
- Podpora dodania do EÚ oslobodeného od DPH (§43)
- Riadne / opravné / dodatočné priznanie
- Automatická kontrola nadväznosti na predchádzajúce obdobie
- Krížová kontrola: DPH priznanie vs. KV DPH vs. účtovníctvo
- Kontrola lehoty na odpočet DPH (§51 ods. 2 – max. 12 mesiacov)
- Automatická kontrola pomeru §50 (koeficient) na konci roka
- Výpočet a účtovanie ročného vysporiadania koeficientu

### 4.2 Kontrolný výkaz DPH (KV DPH):
- Automatické rozdelenie do oddielov:
  - **A.1** – údaje z vyhotovených faktúr, v ktorých je suma dane ≥ 5000 EUR
  - **A.2** – údaje z vyhotovených faktúr, v ktorých je suma dane < 5000 EUR
  - **B.1** – údaje z prijatých faktúr, v ktorých je suma dane ≥ 5000 EUR
  - **B.2** – údaje z prijatých faktúr, v ktorých je suma dane < 5000 EUR
  - **B.3** – údaje z prijatých zjednodušených faktúr (bločky do 1000 EUR)
  - **C.1** – údaje z opravných faktúr vyhotovených (dobropisy)
  - **C.2** – údaje z opravných faktúr prijatých
  - **D.1** – údaje z faktúr pri tuzemskom prenose daňovej povinnosti – dodávateľ
  - **D.2** – údaje z faktúr pri tuzemskom prenose daňovej povinnosti – odberateľ
- Generovanie **XML súboru** podľa platnej XSD schémy FS SR (kvdph_*.xsd)
- Validácia krížová s daňovým priznaním DPH
- Opravný / dodatočný kontrolný výkaz
- Kontrola duplicitných záznamov
- Kontrola IČ DPH dodávateľov

### 4.3 Súhrnný výkaz (SV):
- Evidencia dodaní tovaru a služieb do EÚ
- Generovanie **XML súboru** podľa XSD schémy FS SR
- Mesačné / štvrťročné podávanie
- Rozdelenie podľa typu plnenia:
  - Dodanie tovaru do EÚ
  - Poskytnutie služieb do EÚ (§15 ods. 1)
  - Trojstranný obchod (prostredná osoba)
- Krížová kontrola s DPH priznaním (riadky oslobodených plnení)

### 4.4 One-Stop-Shop (OSS):
- Evidencia B2C predajov do EÚ (e-commerce)
- Výpočet DPH podľa sadzieb cieľovej krajiny
- Generovanie OSS priznania
- Limit 10 000 EUR pre povinnosť registrácie
- Prehľad sadzieb DPH v krajinách EÚ

### 4.5 Intrastat hlásenia:
- Evidencia pohybu tovaru v rámci EÚ
- **Hlásenie o prijatí tovaru** (odoslanie)
- **Hlásenie o odoslaní tovaru** (prijatie)
- Prahové hodnoty pre povinnosť hlásenia
- Kódy kombinovanej nomenklatúry (KN)
- Generovanie XML pre Štatistický úrad SR
- Hmotnosť, hodnota, krajina pôvodu, dodacie podmienky

### 4.6 Daňové priznanie k dani z príjmov:
- **DPPO (právnická osoba)**:
  - Výpočet základu dane z účtovného výsledku hospodárenia
  - Pripočítateľné položky:
    - Nedaňové náklady (reprezentácia, pokuty, penále)
    - Manká a škody nad rámec náhrad
    - Tvorba rezerv a opravných položiek nad rámec zákona
    - Odpisy nad rámec daňových odpisov
    - Neuhradené záväzky po splatnosti > 360 dní (§17 ods. 27)
  - Odpočítateľné položky:
    - Oslobodené príjmy
    - Superodpočet na R&D (§30c – ak relevantné)
    - Príjmy zdanené zrážkovou daňou
  - Daňová strata a jej umorovanie (max. 5 rokov, max. 50% základu dane)
  - Sadzba dane 21% / 15% pre mikrodaňovníkov (obrat do 60 000 EUR)
  - Preddavky na daň (štvrťročné / mesačné podľa výšky dane)
  - Generovanie **XML súboru** pre FS SR
  - Riadne / opravné / dodatočné priznanie
- **DPFO typ B (SZČO)**:
  - Príjmy z podnikania §6 ods. 1, 2
  - Paušálne výdavky (60%, max. 20 000 EUR) vs. skutočné výdavky
  - Nezdaniteľné časti základu dane:
    - Na daňovníka (aktuálna suma podľa životného minima)
    - Na manžela/manželku
    - Príspevky na DDS (do 180 EUR)
  - Daňový bonus na deti (aktuálna suma)
  - Zamestnanecká prémia (ak relevantné)
  - Generovanie **XML súboru** pre FS SR

### 4.7 Daňové odpisy vs. účtovné odpisy:
- Odpisové skupiny 0-7 podľa prílohy zákona o dani z príjmov:
  - Skupina 0: 2 roky (osobné automobily s cenou > 48 000 EUR)
  - Skupina 1: 4 roky (stroje, prístroje, osobné automobily)
  - Skupina 2: 6 rokov (osobné automobily, nákladné, nábytok)
  - Skupina 3: 8 rokov (technologické zariadenia, lode)
  - Skupina 4: 12 rokov (budovy na výrobu)
  - Skupina 5: 20 rokov (administratívne budovy)
  - Skupina 6: 40 rokov (bytové budovy, hotely)
  - Skupina 7: bezpečnostné schránky (neuvedená doba)
- Rovnomerné a zrýchlené odpisovanie (vzorce podľa §27, §28 ZDP)
- Prerušenie odpisovania
- Technické zhodnotenie (zvýšenie vstupnej ceny)
- Vyradenie majetku (predaj, likvidácia, manko, dar)
- Porovnanie daňových a účtovných odpisov – rozdiel pre daňové priznanie
- Zostatková cena daňová vs. účtovná

### 4.8 Transfer pricing (pre prepojené osoby):
- Identifikácia prepojených osôb (§2 písm. n) ZDP)
- Evidencia kontrolovaných transakcií
- Skrátená dokumentácia (pre väčšinu malých firiem)
- Úplná dokumentácia (pre veľké firmy)
- Metódy transferového oceňovania (CUP, RPM, CPM, TNMM, PSM)
- Upozornenie ak transakcie s prepojenými osobami prekročia limity

---

## 5. ÚČTOVNÁ ZÁVIERKA

### 5.1 Prípravné práce (checklist):
- [ ] Inventarizácia majetku a záväzkov (§29, §30 zákona o účtovníctve)
- [ ] Kontrola zostatkov pokladne (fyzická inventúra)
- [ ] Odsúhlasenie bankových zostatkov s výpisom k 31.12.
- [ ] Odsúhlasenie pohľadávok a záväzkov (konfirmačné listy)
- [ ] Precenenie pohľadávok/záväzkov v cudzej mene kurzom ECB k 31.12.
- [ ] Tvorba/rozpustenie opravných položiek
- [ ] Tvorba/čerpanie/rozpustenie rezerv
- [ ] Zaúčtovanie časového rozlíšenia
- [ ] Zaúčtovanie dohadných položiek
- [ ] Výpočet a zaúčtovanie odpisov za posledný mesiac
- [ ] Kontrola analytickej evidencie vs. syntetické účty
- [ ] Kontrola Obratová predvaha: MD celkom = D celkom
- [ ] Kontrola 343 (DPH) – zostatok zodpovedá DPH priznaniu za december/Q4
- [ ] Zaúčtovanie dane z príjmov (591/341)
- [ ] Kontrola bilancie (Aktíva = Pasíva)

### 5.2 Uzávierkové operácie:
- Uzavretie výnosových a nákladových účtov cez účet **710 – Účet ziskov a strát**
- Prevod hospodárskeho výsledku na **702 – Konečný účet súvahový**
- Uzavretie súvahových účtov cez 702
- Výsledok hospodárenia → 431 – Výsledok hospodárenia v schvaľovaní

### 5.3 Výstupy účtovnej závierky:
- **Súvaha** vo formáte MF SR (Úč 1-01), mikroúčtovné jednotky (Úč 1-01 mic)
- **Výkaz ziskov a strát** vo formáte MF SR (Úč 2-01), mikroúčtovné jednotky (Úč 2-01 mic)
- **Poznámky k účtovnej závierke** – predpripravená šablóna podľa Opatrenia MF SR:
  - Všeobecné údaje
  - Účtovné zásady a metódy
  - Doplňujúce údaje k súvahe
  - Doplňujúce údaje k výkazu ziskov a strát
  - Ďalšie doplňujúce údaje
  - **AI generovanie textovej časti poznámok** na základe účtovných dát
- Export do **XML pre podanie na Register účtovných závierok (RÚZ)**
- Kontrola bilancie (Aktíva = Pasíva) – systém neumožní odoslať ak nesedí
- Uzavretie účtovného obdobia (zamknutie pred úpravami)
- Otvorenie nového obdobia (počiatočné stavy cez **701 – Začiatočný účet súvahový**)

### 5.4 Konsolidovaná účtovná závierka:
- Pre skupiny firiem (materská + dcérske spoločnosti)
- Konsolidačné úpravy:
  - Vylúčenie vzájomných transakcií
  - Vylúčenie vzájomných pohľadávok/záväzkov
  - Vylúčenie vzájomných výnosov/nákladov
  - Podiel menšinových vlastníkov
- Konsolidovaná súvaha
- Konsolidovaný výkaz ziskov a strát
- Plná / proporcionálna / equity metóda konsolidácie

### 5.5 Mikroúčtovná jednotka:
- Zjednodušený rozsah účtovnej závierky
- Automatické určenie či firma spĺňa podmienky (§2 ods. 5 – celková suma majetku do 350 000 EUR, obrat do 700 000 EUR, do 10 zamestnancov)
- Zjednodušené výkazy Úč 1-01 mic a Úč 2-01 mic

---

## 6. OCR MODUL – Inteligentné načítavanie dokladov

### 6.1 Podporované formáty:
- **JPG, JPEG, PNG** – fotky bločkov, faktúr, pokladničných dokladov
- **PDF** – skenované aj digitálne PDF faktúry
- **HEIC/HEIF** – fotky z iPhone (automatická konverzia na JPG)
- **TIFF** – skenované dokumenty
- **Multi-page PDF** – extrakcia údajov z viacstranových dokumentov
- **Webp** – moderný obrazový formát

### 6.2 OCR Engine:
- Primárne: **Anthropic Claude Vision API** (claude-sonnet-4-20250514) – najvyššia presnosť
- Fallback: **Tesseract.js** pre offline spracovanie
- Automatický výber enginu podľa dostupnosti a nastavení

### 6.3 Automatická extrakcia údajov:
- Dodávateľ (názov, IČO, DIČ, IČ DPH, adresa, IBAN)
- Číslo faktúry / číslo dokladu
- Dátum vystavenia, dodania, splatnosti
- Položky (názov, množstvo, merná jednotka, jednotková cena, DPH sadzba)
- Celková suma, základ dane, DPH rozdelená podľa sadzieb (20%, 10%, 5%)
- Bankový účet IBAN dodávateľa, BIC/SWIFT
- Variabilný symbol, konštantný symbol
- Mena dokladu
- Typ dokladu (faktúra, bločok, dobropis, zálohová faktúra)

### 6.4 Inteligentné spracovanie:
- **Split view**: Preview nahraného dokladu vedľa extrahovaných údajov
- Manuálna korekcia extrahovaných údajov pred uložením
- **AI automatické predkontácie** – navrhne účtovanie na základe obsahu dokladu
- **AI kategorizácia** – automatické určenie typu nákladu/výnosu
- Uloženie originálneho dokladu ako príloha k účtovnému zápisu (Supabase Storage)
- Drag & drop nahrávanie
- **Hromadné spracovanie** (batch upload) – nahrať 50 bločkov naraz
- **Rozpoznanie duplicitných dokladov** (rovnaké číslo faktúry + dodávateľ + suma)
- Automatické vyhľadanie dodávateľa v databáze kontaktov (podľa IČO z dokladu)
- Automatické vytvorenie nového kontaktu ak neexistuje
- Confidence score – miera istoty OCR pri každom poli
- Zvýraznenie polí s nízkou istotou na manuálnu kontrolu

### 6.5 Zaručená konverzia (§31a zákona o účtovníctve):
- Digitalizácia papierových dokladov s právnou platnosťou
- Zachovanie pôvodného obsahu a vizuálnej zhody
- Kvalifikovaný elektronický podpis alebo kvalifikovaná elektronická pečať
- Kvalifikovaná elektronická časová pečiatka
- Automatická archivácia pôvodného aj konvertovaného dokladu

---

## 7. AI MODUL – Inteligentný účtovný asistent

### 7.1 AI Chatbot v aplikácii:
- Priamo integrovaný chat v sidebar/modal (Claude API)
- Prístup ku všetkým účtovným dátam firmy (readonly)
- Príklady otázok:
  - "Aký je môj obrat za Q3 2025?"
  - "Koľko dlhuje firma XY?"
  - "Aké sú moje najväčšie nákladové položky?"
  - "Mám nejaké faktúry po splatnosti?"
  - "Koľko mám odviesť na DPH tento mesiac?"
  - "Porovnaj tržby tento rok vs. minulý rok"
  - "Kedy mám podať kontrolný výkaz?"
  - "Aký je stav mojej pokladne?"
- Kontextové odpovede na základe reálnych dát firmy
- História konverzácií

### 7.2 AI Predkontácie:
- Automatický návrh účtovania na základe:
  - Obsahu dokladu (OCR text)
  - Dodávateľa (typ dodávateľa, história účtovania)
  - Sumy a typu transakcie
- Učenie sa z predchádzajúcich zápisov (per-company model):
  - "Dodávateľ Orange → vždy účtuj 518/321"
  - "Bločky z čerpacích staníc → 501/211"
- Manuálne potvrdenie/úprava navrhnutého účtovania
- Confidence score pre každú predkontáciu

### 7.3 AI Anomaly Detection:
- Upozornenie na neobvyklé transakcie:
  - Suma výrazne odlišná od priemeru (napr. 10x vyššia ako obvykle)
  - Duplicitné platby (rovnaká suma, rovnaký dodávateľ, krátky časový interval)
  - Chýbajúce doklady (platba bez faktúry)
  - Neobvyklý dodávateľ (prvýkrát, vysoká suma)
- Upozornenie na účtovné nezrovnalosti:
  - Nesúlad medzi DPH priznaním a účtovníctvom
  - Nerovnováha MD ≠ D
  - Zostatok na účte 343 nesedí s priznaním
  - Neuzavreté záznamy

### 7.4 AI Kategorizácia výdavkov:
- Automatické určenie: daňový vs. nedaňový náklad
- Kategórie: materiál, služby, energie, PHM, nájom, mzdy, reprezentácia, cestovné
- Označenie limitovaných nákladov (napr. odpisy áut nad 48 000 EUR, normatívy)
- Učenie sa z korekcií používateľa

### 7.5 AI Predikcia Cash Flow:
- Predpoveď príjmov na základe:
  - Splatností vydaných faktúr
  - Historickej platobnej morálky odberateľov
  - Opakujúcich sa príjmov
- Predpoveď výdavkov na základe:
  - Splatností prijatých faktúr
  - Pravidelných platieb (nájom, poistné, energie, mzdy)
  - Daňových povinností (DPH, daň z príjmov, odvody)
- Vizualizácia: graf predikovaného cash flow na 30/60/90 dní

### 7.6 AI Kontrola kompletnosti:
- Pred účtovnou závierkou AI skontroluje:
  - Chýbajúce doklady v číselnom rade
  - Neuhradené faktúry staršie ako 360 dní (upozornenie na odpis / opravnú položku)
  - Nezaúčtované bankové pohyby
  - Chýbajúce interné doklady (odpisy, časové rozlíšenie)
  - Zostatky na prechodných účtoch (261, 395)
  - Kontrola súladu pokladne, banky, DPH
- Generuje report s odporúčaniami

### 7.7 AI Generovanie poznámok k závierke:
- Na základe účtovných dát automaticky vygeneruje draft poznámok:
  - Opis účtovných metód a zásad
  - Komentáre k významným zmenám (medziročne)
  - Opis štruktúry majetku, záväzkov, vlastného imania
  - Priemerný počet zamestnancov, osobné náklady
  - Významné udalosti po dni závierky (manuálny vstup)

### 7.8 Smart vyhľadávanie:
- Natural language search cez celú aplikáciu:
  - "Nájdi faktúru pre Telekom z marca"
  - "Ukáž všetky platby nad 5000 EUR"
  - "Kto nám dlhuje viac ako 30 dní?"
- Fulltextové vyhľadávanie v dokladoch (aj v OCR texte)

---

## 8. BANKOVÝ MODUL

### 8.1 Import bankových výpisov:
- **MT940** (SWIFT formát – väčšina bánk)
- **XML SEPA camt.053** (ISO 20022)
- **CSV** (s mapovaním stĺpcov pre rôzne banky)
- **OFX/QFX** (Quicken formát)
- Podpora slovenských bánk: Tatra banka, VÚB, ČSOB, Slovenská sporiteľňa, mBank, Fio, UniCredit, Prima banka

### 8.2 Automatické párovanie platieb:
- Párovanie podľa VS (variabilný symbol) – primárne
- Párovanie podľa sumy + IČO
- Párovanie podľa názvu protistrany
- Párovanie podľa IBAN protistrany
- Fuzzy matching (čiastočná zhoda)
- Párované vs. nepárované platby – prehľadné rozlíšenie
- Manuálne párovanie nenapárovaných platieb (drag & drop)
- Rozdelenie platby na viacero faktúr (čiastočné úhrady)
- Preplatky – automatické zaúčtovanie alebo prenos na ďalšiu faktúru

### 8.3 Automatické účtovanie:
- Účtovanie na základe párovania: 221/311 (úhrada pohľadávky), 321/221 (úhrada záväzku)
- Pravidlá pre opakujúce sa transakcie:
  - "ORANGE paušál → 518/221"
  - "ALLIANZ poistné → 548/221"
  - "NÁJOM BRATISLAVA → 518/221"
- Multi-bankové účty (221.1, 221.2 atď.)
- Saldo bankových účtov v reálnom čase

### 8.4 Bankové príkazy:
- Export **SEPA XML pain.001** – hromadné príkazy na úhradu
- Generovanie príkazov z neuhradených prijatých faktúr
- Schvaľovací workflow pre platby nad limit
- Plánované platby (future-dated)

---

## 9. SKLADOVÝ MODUL

### 9.1 Skladová evidencia:
- **Príjemky** (nákup, vrátenie od zákazníka, výroba, prevod z iného skladu)
- **Výdajky** (predaj, spotreba, likvidácia, prevod na iný sklad)
- **Prevodky** medzi skladmi
- **Inventúra** – inventúrne súpisy, inventarizačné rozdiely:
  - Manká (549/112, 549/132)
  - Prebytky (112/648, 132/648)
- Oceňovanie zásob:
  - **FIFO** (First In, First Out)
  - **Vážený aritmetický priemer** (priebežný / periodický)
- Minimálne zásoby – notifikácia pri dosiahnutí
- Maximálne zásoby – varovanie pri prekročení
- Sériové čísla / šarže (voliteľné)
- Čiarové kódy / EAN

### 9.2 Prepojenie s fakturáciou:
- Automatické vytvorenie výdajky pri fakturácii
- Automatická príjemka pri prijatej faktúre za tovar
- Kontrola dostupnosti na sklade pred fakturáciou
- Cenotvorba:
  - Nákupná cena → predajná cena (marža %, prirážka %)
  - Cenové hladiny (veľkoobchod, maloobchod, VIP)

### 9.3 Výstupy:
- Skladové karty (pohyby, zostatky)
- Stav zásob k dátumu
- Obratovka skladu (za obdobie)
- Inventúrny súpis
- ABC analýza zásob
- Hodnota skladu (celková, po kategóriách)

---

## 10. MZDOVÝ MODUL

### 10.1 Evidencia zamestnancov:
- Osobné údaje (GDPR compliant – šifrovanie v DB):
  - Meno, priezvisko, rodné číslo, dátum narodenia
  - Trvalý pobyt, prechodný pobyt
  - Bankový účet IBAN
  - Číslo OP / pasu
  - Rodinný stav, počet detí (pre daňové účely)
- Zdravotná poisťovňa (VšZP, Union, Dôvera)
- Sociálna poisťovňa – registračné číslo
- Pracovné zmluvy:
  - Hlavný pracovný pomer (HPP)
  - Dohoda o vykonaní práce (DoVP)
  - Dohoda o pracovnej činnosti (DoPČ)
  - Dohoda o brigádnickej práci študentov (DoBPŠ)
- Mzdové údaje (hrubá mzda, tarifný stupeň, príplatky)
- Dovolenka (nárok, čerpanie, zostatok)
- Pracovná neschopnosť (PN)
- Evidencia dochádzky

### 10.2 Výpočet miezd:
- **Hrubá mzda → čistá mzda** (kompletný výpočtový algoritmus):
  - Hrubá mzda
  - \- Zdravotné poistenie zamestnanec (4%)
  - \- Sociálne poistenie zamestnanec (9.4%):
    - Nemocenské 1.4%
    - Starobné dôchodkové 4%
    - Invalidné dôchodkové 3%
    - Poistenie v nezamestnanosti 1%
  - = Čiastkový základ dane
  - \- Nezdaniteľná časť základu dane (aktuálna suma / 12)
  - = Základ dane
  - × Sadzba dane (19% do limitu, 25% nad limit)
  - \- Daňový bonus na deti
  - = Preddavok na daň
  - = **Čistá mzda**
- Odvody zamestnávateľ:
  - ZP 10% (+ 2% príplatok za ZŤP zamestnanca)
  - SP 25.2%:
    - Nemocenské 1.4%
    - Starobné dôchodkové 14%
    - Invalidné dôchodkové 3%
    - Poistenie v nezamestnanosti 1%
    - Garančný fond 0.25%
    - Rezervný fond solidarity 4.75%
    - Úrazové poistenie 0.8%
- Príplatky podľa Zákonníka práce:
  - Nočná práca (min. 40% min. mzdy)
  - Práca cez víkend – sobota (min. 50% min. mzdy)
  - Práca cez víkend – nedeľa (min. 100% min. mzdy)
  - Práca vo sviatok (min. 100% priemerného zárobku)
  - Nadčas (min. 25% priemerného zárobku)
- Náhrada mzdy za dovolenku (priemerný zárobok)
- Náhrada príjmu pri PN (prvých 10 dní – zamestnávateľ: 25% 1.-3. deň, 55% 4.-10. deň)
- Dohody:
  - DoVP – zrážková daň 19% (do 500 EUR/mesiac)
  - DoPČ – ako HPP alebo zrážková (do 500 EUR)
  - DoBPŠ – odvodová úľava (do 200 EUR), zrážková daň
- Stravné lístky / finančný príspevok na stravovanie (min. 55% ceny jedla)
- Zrážky zo mzdy (exekúcie, pôžičky, odbory)
- 13. a 14. plat (oslobodenie od dane/odvodov podľa podmienok)
- Odstupné, odchodné, náhrada za nevyčerpanú dovolenku
- Účtovanie miezd:
  - 521/331 – hrubé mzdy
  - 524/336.1 – odvody ZP zamestnávateľ
  - 524/336.2 – odvody SP zamestnávateľ
  - 331/342 – preddavok na daň
  - 331/336.1 – ZP zamestnanec
  - 331/336.2 – SP zamestnanec
  - 331/221 – výplata čistej mzdy

### 10.3 Výstupy a hlásenia:
- **Výplatná páska** (PDF) – detailný rozpis pre zamestnanca
- **Výplatná listina** – sumár za celú firmu
- **Mesačný prehľad o zrazených preddavkoch** na daň (§35 ods. 6 ZDP) – **XML pre FS SR**
- **Ročné hlásenie o vyúčtovaní dane** (§39 ods. 9 ZDP) – **XML pre FS SR**
- **Potvrdenie o zdaniteľných príjmoch** (§39 ods. 5 ZDP) – PDF pre zamestnanca
- **Mesačné výkazy do Sociálnej poisťovne**:
  - RLFO (Registračný list fyzickej osoby) – prihlásenie/odhlásenie
  - MVP (Mesačný výkaz poistného) – **XML**
- **Mesačné oznámenie platiteľa do zdravotnej poisťovne** – **XML**
- Rekapitulácia miezd (mesačná, ročná)
- Evidenčný list dôchodkového poistenia (ELDP) – pri odchode zamestnanca
- Potvrdenie o zamestnaní (zápočtový list)
- Ročné zúčtovanie preddavkov na daň (ak zamestnanec nepodáva vlastné DP)

---

## 11. CESTOVNÉ PRÍKAZY

### 11.1 Tuzemské cestovné príkazy:
- Stravné sadzby podľa platného Opatrenia MPSVR SR:
  - 5-12 hodín: aktuálna sadzba (sledovať zmeny!)
  - 12-18 hodín: aktuálna sadzba
  - nad 18 hodín: aktuálna sadzba
- Krátenie stravného pri poskytnutí bezplatného jedla (raňajky, obed, večera – 25%, 40%, 35%)
- Cestovné (autobus, vlak, taxi – podľa dokladov)
- **Náhrada za použitie súkromného motorového vozidla**:
  - Sadzba za km (aktuálna podľa opatrenia MPSVR)
  - Spotreba PHM podľa TP vozidla
  - Cena PHM (doklad z čerpacej stanice alebo štatistický priemer)
- Ubytovanie (podľa dokladov)
- Vedľajšie výdavky (parkovné, diaľničná známka, MHD)

### 11.2 Zahraničné cestovné príkazy:
- Stravné sadzby podľa **Opatrenia MF SR** pre jednotlivé krajiny (automatické doplnenie)
- Vreckové (do 40% stravného)
- Krátenie stravného pri poskytnutí jedla
- Kapesné v cudzej mene
- Prepočet cudzej meny kurzom NBS/ECB k dátumu uskutočnenia cesty
- Vyúčtovanie preddavku (vrátenie/doplatok)
- Cestovné poistenie

### 11.3 Výstupy:
- Cestovný príkaz (PDF) – pred cestou (schválenie)
- Vyúčtovanie cestovných náhrad (PDF) – po ceste
- Automatické účtovanie: 512/211 (hotovosť), 512/321 (bezhotovostne), 335/211 (preddavok)

---

## 12. ELEKTRONICKÝ PODPIS A eDane

### 12.1 Elektronický podpis:
- Podpora **kvalifikovaného elektronického podpisu** (KEP):
  - Pre faktúry (§71 ods. 1 písm. c) zákona o DPH)
  - Pre daňové podania
  - Pre zaručenú konverziu dokladov
- Integrácia s **eID** (slovenský občiansky preukaz s čipom)
- Podpora **kvalifikovanej elektronickej pečate** (pre automatizované procesy)
- **Kvalifikovaná časová pečiatka** pre archiváciu

### 12.2 Napojenie na eDane / portál FS SR:
- Pripravená architektúra pre automatické podávanie:
  - DPH priznanie
  - Kontrolný výkaz DPH
  - Súhrnný výkaz
  - Daňové priznanie DPPO / DPFO
  - Mesačný prehľad dane zo závislej činnosti
  - Ročné hlásenie
- Validácia XML voči aktuálnym XSD schémam pred odoslaním
- Archív podaných priznaní

### 12.3 eKasa integrácia:
- Napojenie na **eKasa systém** (zákon č. 289/2008 Z.z.)
- Evidencia tržieb z registračnej pokladnice
- Párované s pokladničnými dokladmi v účtovníctve
- Import denných uzávierok z eKasy

---

## 13. KLIENTSKÝ PORTÁL A ONLINE PLATBY

### 13.1 Klientský portál:
- Samostatný login pre odberateľov (zákazníkov)
- Prehľad ich faktúr (neuhradené, uhradené, po splatnosti)
- Download PDF faktúr
- **Online platba** priamo z portálu
- História platieb
- Reklamácie a komunikácia
- Branding: logo firmy, firemné farby

### 13.2 Online platby:
- **Stripe** integrácia (kartové platby)
- **GoPay** integrácia (slovenský platobný gateway)
- **PayPal** (voliteľné)
- Platobný link v emaile s faktúrou
- QR kód PAY by square (bankový prevod)
- Automatické párovanie online platieb s faktúrami
- Čiastočné platby
- Automatické účtovanie prijatej platby

---

## 14. REPORTING A MANAŽÉRSKE VÝSTUPY

### 14.1 Finančné reporty:
- **Aging report pohľadávok** – 0-30, 31-60, 61-90, 91-180, 180+ dní po splatnosti
- **Aging report záväzkov** – rovnaké členenie
- **Cash flow prognóza** (AI-driven) – 30/60/90 dní dopredu
- **Rentabilita zákaziek** – príjmy vs. náklady na zákazku/stredisko/projekt
- **Porovnanie období** – mesiac vs. mesiac, kvartál vs. kvartál, rok vs. rok
- **Marža na produkt/službu** – z fakturácie a skladovej evidencie
- **Top 10 odberateľov** podľa obratu, ziskovosti, platobnej morálky
- **Top 10 dodávateľov** podľa objemu nákupov
- **Neuhradené faktúry** – prehľadný zoznam s možnosťou hromadných upomienok
- **Break-even analýza** – fixné vs. variabilné náklady, bod zvratu
- **Finančné ukazovatele**:
  - Bežná likvidita (obežné aktíva / krátkodobé záväzky)
  - Pohotová likvidita
  - Celková zadlženosť
  - ROA, ROE, ROS
  - Doba obratu pohľadávok, záväzkov, zásob

### 14.2 Štatistické výkazy:
- **Výkazy pre Štatistický úrad SR** (Štvrťročný výkaz, Ročný výkaz – Úč POD, Úč MÚJ)
- Podklady pre štatistické zisťovania

### 14.3 Dashboard widgety:
- Graf tržieb (mesačný, ročný trend, porovnanie s predchádzajúcim rokom)
- Graf nákladov podľa kategórií (koláčový, stĺpcový)
- Cash flow graf (príjmy vs. výdavky – stacked bar)
- AI predikcia cash flow (čiarkovaná čiara do budúcnosti)
- DPH povinnosť aktuálny mesiac/štvrťrok
- Stav pokladne a bankových účtov
- Rýchle metriky: obrat, zisk, pohľadávky, záväzky, počet faktúr
- Blížiace sa termíny (splatnosti faktúr, daňové podania) – timeline
- Anomálie detekované AI (červené upozornenia)
- Konfigurovateľný dashboard (drag & drop widgety, resize)

### 14.4 Exporty:
- Všetky výkazy exportovateľné do **PDF, XLSX, CSV**
- Hromadný export účtovných dát
- Export pre audítora (ZIP s kompletnou dokumentáciou)
- **Automatické reporty** – emailom v nastavený deň (denný, týždenný, mesačný)

---

## 15. NOTIFIKAČNÝ SYSTÉM

### 15.1 Email notifikácie:
- Faktúra po splatnosti (1 deň, 7 dní, 14 dní, 30 dní – konfigurovateľné)
- Blížiace sa termíny podania:
  - DPH / KV DPH / SV (7 dní pred, 3 dni pred, v deň)
  - Daňové priznanie DPPO/DPFO
  - Mesačný prehľad dane zo závislej činnosti
  - Ročné hlásenie
- Blížiaca sa účtovná závierka
- Schválenie faktúry / platby (workflow)
- Nová prijatá faktúra (po OCR spracovaní)
- Minimálna zásoba na sklade dosiahnutá
- Online platba prijatá
- Bankový výpis importovaný – nepárované platby
- AI anomália detekovaná

### 15.2 In-app notifikácie:
- Zvonček v headeri s počtom neprečítaných
- Notifikačné centrum s históriou a filtrovaním
- Real-time notifikácie (Supabase Realtime)
- Push notifikácie (PWA Service Worker)

### 15.3 Nastavenia notifikácií:
- Konfigurovateľné pravidlá (čo, kedy, komu, aký kanál)
- Prispôsobiteľné emailové šablóny (s logom firmy)
- Integrácia s SMTP: vlastný mailserver / **Resend** / **SendGrid**
- Tichý režim (napr. cez víkend)

---

## 16. ARCHIVÁCIA, AUDIT A COMPLIANCE

### 16.1 Zákonná archivácia:
- Účtovné doklady uchovávať **10 rokov** (§35 zákona o účtovníctve)
- Účtovná závierka a výročná správa **10 rokov**
- Daňové doklady **10 rokov** (§76 zákona o DPH)
- Mzdové listy a výplatné listiny **50 rokov** (zákon o archívoch a registratúrach)
- Pracovné zmluvy **50 rokov** po ukončení PP
- Automatické upozornenie pred uplynutím archivačnej lehoty
- Digitálny archív s indexovaním a fulltextovým vyhľadávaním
- Automatická archivácia po uzavretí obdobia

### 16.2 Audit trail:
- Kompletná história zmien na každom doklade:
  - Kto (user_id, meno)
  - Kedy (timestamp)
  - Čo zmenil (staré hodnoty → nové hodnoty, JSON diff)
  - Odkiaľ (IP adresa, user agent)
- **Nemeniteľnosť** uzavretých období (systém neumožní editovať zaúčtované doklady v uzavretom období)
- Log všetkých prihlásení a akcií
- Export audit logu (PDF, CSV)
- Automatická detekcia podozrivých aktivít (napr. hromadné mazanie)

### 16.3 GDPR compliance:
- **Šifrovanie** citlivých osobných údajov v databáze (rodné čísla, bankové účty)
- **Právo na vymazanie** – anonymizácia osobných údajov (pri zachovaní účtovných dát – zákon o účtovníctve má prednosť počas archivačnej lehoty)
- **Právo na prístup** – export osobných údajov osoby (JSON/PDF)
- **Právo na prenositeľnosť** – export dát v strojovo čitateľnom formáte
- Evidencia spracúvania osobných údajov (záznam §37 GDPR)
- Informácia o spracúvaní (privacy policy) – vygenerovaná šablóna
- Súhlas so spracúvaním (kde potrebný) – evidencia súhlasov
- DPO (Data Protection Officer) – kontaktné údaje v nastaveniach
- Lehoty uchovávania – automatické upozornenie na uplynutie

### 16.4 Whistleblowing (zákon č. 54/2019 Z.z.):
- Pre firmy s 50+ zamestnancami
- Anonymný kanál na nahlásenie protispoločenskej činnosti
- Evidencia podaní
- Spätná väzba oznamovateľovi

### 16.5 Zálohovanie:
- Automatický backup databázy (denný, cez Supabase)
- Manuálny export kompletných dát firmy (ZIP archív)
- Obnova zo zálohy
- Zálohy na externé úložisko (voliteľné – S3 compatible)
- Testovanie obnovy (verifikácia integrity)

---

## 17. INTEGRÁCIE A IMPORT/EXPORT

### 17.1 API pre externé systémy:
- **REST API** s autentifikáciou (API kľúče, OAuth 2.0)
- **Webhooky** – notifikácia externých systémov o udalostiach:
  - Nová faktúra vytvorená
  - Platba prijatá
  - Doklad zaúčtovaný
  - DPH priznanie vygenerované
- API dokumentácia (Swagger / OpenAPI 3.0)
- Rate limiting
- API logy

### 17.2 Import z iných systémov:
- **Pohoda XML** – import/export dát (faktúry, kontakty, účtovné zápisy, skladsklad)
- **SuperFaktúra** – import faktúr cez API
- **Money S3** – import XML
- **iDoklad** – import CSV/API
- **CSV univerzálny import** – s mapovaním stĺpcov (wizard)
- **XLSX import** – s mapovaním stĺpcov
- Validácia importovaných dát pred uložením
- Log importu (úspešné / chybné záznamy)

### 17.3 Export:
- **SEPA XML pain.001** – bankové príkazy na úhradu
- **UBL 2.1 / ISDOC** – e-faktúry
- **Pohoda XML** – export pre účtovníkov používajúcich Pohodu
- **Datev** – pre medzinárodný audit
- **XML pre Finančnú správu SR** – všetky daňové podania
- **XML pre Sociálnu poisťovňu** – MVP, RLFO
- **XML pre Zdravotné poisťovne** – oznámenia
- **XML pre RÚZ** – účtovná závierka
- **MT940** – bankové výpisy (re-export)

### 17.4 Automatická synchronizácia:
- Kurzový lístok ECB/NBS – denné sťahovanie (cron)
- Zoznamy FS SR – platitelia DPH, vymazaní platitelia (denné/týždenné)
- Sankčné zoznamy EÚ (týždenné)
- Sadzby stravného – po zmene legislatívy (manuálny update + notifikácia)

---

## 18. MULTI-MENA

- Automatické denné sťahovanie kurzov z **ECB** a **NBS** (Supabase Edge Function + pg_cron)
- Kurzový lístok – prehľad kurzov k ľubovoľnému dátumu
- Prepočet cudzej meny na EUR podľa kurzu k dátumu dodania
- Automatické účtovanie kurzových rozdielov pri úhrade:
  - 563 – kurzová strata (MD)
  - 663 – kurzový zisk (D)
- Precenenie pohľadávok/záväzkov v cudzej mene k 31.12. (uzávierkový kurz ECB)
- Podpora mien: USD, GBP, CZK, HUF, PLN, CHF, SEK, NOK, DKK, RON, BGN, HRK, JPY, CNY, CAD, AUD + konfigurovateľné ďalšie
- Faktúry a doklady v cudzej mene s duálnym zobrazením (cudzia mena + EUR)
- Pokladňa v cudzej mene (valutová pokladňa)

---

## 19. MULTI-COMPANY MANAGEMENT

- Jeden používateľ môže spravovať **viacero firiem** (prepínanie medzi firmami)
- Každá firma má vlastné nastavenia, účtový rozvrh, číslovanie
- Zdieľaný adresár kontaktov (voliteľné)
- Konsolidovaný prehľad cez všetky firmy (dashboard)
- Rôzne role v rôznych firmách (admin v jednej, readonly v druhej)
- Intercompany transakcie (faktúry medzi vlastnými firmami)
- Konsolidovaná závierka (viď sekcia 5.4)

---

## 20. PWA MOBILNÁ APLIKÁCIA

- **Progressive Web App** (inštalovateľná na mobile)
- Kľúčové mobilné funkcie:
  - **Fotenie bločkov** – okamžité OCR spracovanie
  - Prehľad neuhradených faktúr
  - Rýchle vytváranie faktúr
  - Schvaľovanie dokladov (workflow)
  - Dashboard (zjednodušený)
  - Push notifikácie
- Offline podpora:
  - Fotenie bločkov offline → sync po pripojení
  - Prehliadanie existujúcich dát offline (IndexedDB cache)
- Optimalizovaný pre dotykové ovládanie
- Camera API pre skenovanie dokladov
- Zdieľanie faktúr (PDF) cez native share

---

## 21. TECHNICKÉ POŽIADAVKY

### 21.1 Stack:
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes + Supabase (PostgreSQL 15+, Auth, Storage, Edge Functions, Realtime)
- **ORM/Query**: Supabase JS Client + drizzle-orm (pre complex queries)
- **PDF generovanie**: @react-pdf/renderer (faktúry, výplatné pásky, výkazy)
- **QR kód**: PAY by square generátor (qrcode + bysquare knižnica)
- **XML generovanie**: fast-xml-parser alebo xmlbuilder2
- **XML validácia**: libxmljs2 alebo xsd-schema-validator (validácia voči XSD)
- **OCR**: Anthropic Claude Vision API (primárne) + Tesseract.js (fallback)
- **AI**: Anthropic Claude API (chatbot, predkontácie, anomálie, predikcie)
- **Grafy/reporty**: Recharts + shadcn/ui charts
- **Export**: XLSX (SheetJS/ExcelJS), CSV, PDF, XML
- **Email**: Resend (primárne) / SendGrid / nodemailer
- **Platby**: Stripe SDK, GoPay API
- **Cron/Scheduling**: Supabase Edge Functions + pg_cron
- **Validácia**: Zod (frontend + backend)
- **State management**: Zustand alebo React Context
- **Forms**: React Hook Form + Zod resolver
- **Dates**: date-fns (timezone Europe/Bratislava)
- **Search**: pg_trgm + ts_vector (fulltext search v PostgreSQL)
- **Real-time**: Supabase Realtime (notifikácie, live updates)
- **File upload**: tus protocol alebo Supabase Storage upload
- **PWA**: next-pwa, Service Worker, IndexedDB (Dexie.js)

### 21.2 Databáza (Supabase PostgreSQL):

Navrhni kompletnú databázovú schému. Všetky tabuľky musia mať:
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `company_id` UUID NOT NULL REFERENCES companies(id) – pre RLS
- `created_at` TIMESTAMPTZ DEFAULT now()
- `updated_at` TIMESTAMPTZ DEFAULT now()
- `created_by` UUID REFERENCES users(id)
- `updated_by` UUID REFERENCES users(id)
- `deleted_at` TIMESTAMPTZ NULL – soft delete

**Jadro:**
- `companies` – firemné údaje (IČO, DIČ, IČ DPH, sídlo, logo, pečiatka, predmet podnikania, typ účtovníctva PÚ/JÚ, veľkostná kategória)
- `company_settings` – konfigurácia per company (číslovanie, predvolené sadzby DPH, mena, jazyk, SMTP, notifikácie)
- `users` – používatelia, email, meno
- `user_company_roles` – väzba user-company-role (M:N)
- `roles` – admin, účtovník, fakturant, mzdár, skladník, readonly
- `permissions` – granulárne oprávnenia per modul (CRUD)
- `fiscal_years` – účtovné obdobia (od, do, stav: otvorené/uzavreté/v_závierke)
- `number_sequences` – číselné rady (faktúry, doklady, interné – prefix, posledné číslo, formát)

**Kontakty:**
- `contacts` – odberatelia, dodávatelia, zamestnanci (typ, IČO, DIČ, IČ DPH, adresa, email, telefón, web, kreditný limit, platobná morálka, tagy)
- `contact_persons` – kontaktné osoby pod firmou
- `contact_bank_accounts` – bankové účty kontaktov (IBAN, BIC, mena)
- `contact_verifications` – log overení (VIES, DPH zoznam, insolvencia, RPVS, sankcie)

**Fakturácia:**
- `invoices` – faktúry (typ: vydaná/prijatá/zálohová/dobropis/proforma, číslo, dátumy, sumy, mena, kurz, stav: draft/odoslaná/uhradená/po_splatnosti/stornovaná, VS, KS, ŠS, poznámka, parent_invoice_id pre dobropisy, reverse_charge boolean)
- `invoice_items` – položky faktúr (názov, množstvo, MJ, jednotková cena, DPH sadzba, základ dane, DPH, celkom, product_id, účet MD, účet D)
- `invoice_payments` – úhrady faktúr (dátum, suma, spôsob, bank_transaction_id)
- `recurring_invoices` – šablóny opakujúcich sa faktúr (interval, posledné generovanie, ďalšie generovanie)
- `reminders` – upomienky (stupeň, dátum odoslania, invoice_id)
- `quotes` – cenové ponuky (konvertovateľné na faktúru)
- `orders` – objednávky (konvertovateľné na faktúru)
- `delivery_notes` – dodacie listy

**Účtovníctvo:**
- `chart_of_accounts` – účtový rozvrh (syntetický účet, analytický účet, názov, typ: aktívny/pasívny/výnosový/nákladový, daňový boolean, podsúvahový boolean, aktívny boolean)
- `journal_entries` – účtovné zápisy hlavička (číslo dokladu, typ dokladu: FA/PFA/ID/BV/PPD/VPD, dátum, popis, stav: draft/zaúčtovaný, fiscal_year_id, source_invoice_id, source_document_id)
- `journal_entry_lines` – riadky zápisov (account_id, strana: MD/D, suma, suma v mene, mena, kurz, cost_center_id, project_id, popis)
- `predkontacie` – prednastavené účtovné predpisy (názov, typ dokladu, riadky s účtami MD/D, podmienky)
- `cost_centers` – strediská
- `projects` – zákazky/projekty

**Banka:**
- `bank_accounts` – bankové účty firmy (názov, IBAN, BIC, mena, syntetický účet 221.x, počiatočný zostatok)
- `bank_statements` – bankové výpisy (číslo výpisu, dátum, počiatočný/konečný zostatok, formát importu)
- `bank_transactions` – bankové pohyby (dátum, suma, protiúčet IBAN, VS, KS, ŠS, správa, stav: nepárovaná/párovaná/zaúčtovaná, matched_invoice_id)
- `bank_matching_rules` – pravidlá (podmienka: text/IBAN/VS, akcia: účet MD, účet D)
- `payment_orders` – príkazy na úhradu (stav, SEPA XML)

**Pokladňa:**
- `cash_registers` – pokladne (názov, mena, počiatočný zostatok, syntetický účet 211.x)
- `cash_transactions` – pokladničné doklady (typ: príjem/výdaj, číslo PPD/VPD, dátum, suma, účel, osoba)

**Majetok:**
- `asset_categories` – odpisové skupiny (číslo 0-7, roky odpisovania, metóda: rovnomerný/zrýchlený, koeficienty)
- `assets` – karty majetku (názov, inventárne číslo, dátum zaradenia, vstupná cena, zostatková cena účtovná/daňová, odpisová skupina, umiestnenie, stav: aktívny/vyradený)
- `asset_depreciations` – mesačné/ročné odpisy (dátum, účtovný odpis, daňový odpis, účtovná ZC, daňová ZC)
- `asset_movements` – zaradenie, technické zhodnotenie, vyradenie (predaj, likvidácia, manko)

**Sklad:**
- `warehouses` – sklady (názov, adresa, zodpovedná osoba)
- `products` – produkty/položky (názov, SKU, EAN, kategória, MJ, DPH sadzba, nákupná cena, predajná cena, min_zásoby, max_zásoby)
- `stock_movements` – pohyby (typ: príjemka/výdajka/prevodka/inventúra, dátum, číslo dokladu, zo_skladu, do_skladu, invoice_id)
- `stock_movement_items` – položky pohybu (product_id, množstvo, cena za MJ, šarža, SN)
- `inventory_checks` – inventúry (dátum, sklad, stav: rozpracovaná/ukončená)
- `inventory_items` – inventúrne položky (product_id, stav_účtovný, stav_skutočný, rozdiel, vysvetlenie)

**Mzdy:**
- `employees` – rozšírené údaje (osobné údaje – šifrované!, zdravotná poisťovňa, sociálna poisťovňa, daňové údaje, dovolenka_nárok)
- `employment_contracts` – pracovné zmluvy (typ: HPP/DoVP/DoPČ/DoBPŠ, dátum od/do, hrubá mzda, úväzok, pozícia)
- `payroll_periods` – výplatné obdobia (mesiac, rok, stav: otvorené/uzavreté)
- `payroll_items` – výplatné pásky (employee_id, hrubá_mzda, zp_zamestnanec, sp_zamestnanec, základ_dane, preddavok_daň, daňový_bonus, čistá_mzda, zp_zamestnávateľ, sp_zamestnávateľ, k_výplate)
- `payroll_deductions` – zrážky (typ: exekúcia/pôžička/iné, suma)
- `attendance` – dochádzka (dátum, od, do, typ: práca/dovolenka/PN/náhradné_voľno/sviatok)
- `leave_balances` – zostatky dovolenky

**Cestovné príkazy:**
- `travel_orders` – cestovné príkazy (zamestnanec, účel, miesto, dátum od/do, dopravný prostriedok, stav: schválený/vyúčtovaný)
- `travel_expenses` – výdavky (typ: stravné/cestovné/ubytovanie/vedľajšie, suma, mena, doklad)
- `travel_allowance_rates` – sadzby stravného (tuzemské: hodiny/sadzba, zahraničné: krajina/sadzba, platnosť od/do)
- `travel_vehicle_rates` – sadzba za km, cena PHM

**Dane:**
- `tax_returns` – daňové podania (typ: DPH/KV_DPH/SV/DPPO/DPFO/mesačný_prehľad/ročné_hlásenie/OSS/Intrastat, obdobie, stav: draft/finálny/podaný, XML súbor, dátum podania, typ: riadne/opravné/dodatočné)
- `tax_return_lines` – riadky daňových podaní (číslo riadku, hodnota)
- `exchange_rates` – kurzový lístok (mena, dátum, kurz, zdroj: ECB/NBS)
- `vat_rates` – sadzby DPH (sadzba %, platnosť od/do, typ: základná/znížená/super_znížená)

**Doklady:**
- `documents` – nahrané doklady (názov, typ: faktúra/bločok/bankový_výpis/zmluva/iné, formát: JPG/PNG/PDF, storage_path, veľkosť, invoice_id, journal_entry_id)
- `document_ocr_results` – výsledky OCR (extrahované polia JSON, confidence scores, engine: claude/tesseract, spracované boolean)

**Jednoduché účtovníctvo:**
- `cash_book_entries` – peňažný denník (dátum, typ: príjem/výdaj, kategória, suma, daňový boolean, text, doklad, pokladňa/banka)

**Systém:**
- `audit_log` – história zmien (tabuľka, záznam_id, akcia: INSERT/UPDATE/DELETE, staré_hodnoty JSONB, nové_hodnoty JSONB, user_id, ip_address, user_agent, timestamp)
- `notifications` – notifikácie (user_id, typ, správa, prečítaná boolean, link, created_at)
- `notification_rules` – pravidlá (udalosť, kanál: email/in-app/push, oneskorenie, šablóna)
- `email_templates` – emailové šablóny (názov, predmet, HTML body, premenné)
- `backups` – zálohy (dátum, veľkosť, storage_path, stav)
- `api_keys` – API kľúče (hash, názov, oprávnenia, posledné_použitie, aktívny)
- `webhook_endpoints` – webhooky (URL, udalosti, secret, aktívny)
- `webhook_logs` – log odoslaných webhookov
- `system_logs` – systémové logy

### 21.3 Databázové funkcie a triggery:
- Trigger: auto-update `updated_at` na každom UPDATE
- Trigger: audit_log zápis pri INSERT/UPDATE/DELETE na dôležitých tabuľkách
- Function: `calculate_invoice_totals()` – prepočet súm pri zmene položiek
- Function: `check_balance()` – kontrola MD = D pri účtovnom zápise
- Function: `generate_next_number(sequence_type)` – generovanie čísla dokladu
- Function: `get_account_balance(account_id, date)` – zostatok účtu k dátumu
- Function: `get_aging_report(type, date)` – aging analýza
- Function: `search_documents(query)` – fulltextové vyhľadávanie
- Materialized views pre časté reporty (obratová predvaha, saldokonto)
- Indexy: B-tree na FK, GIN na JSONB, GiST na fulltext, partial indexes na soft-deleted

### 21.4 Row Level Security (RLS):
- **Multitenantné riešenie** – každá firma vidí len svoje dáta
- `company_id` na každej tabuľke (okrem `users`, `roles`, `permissions`)
- RLS policy: `SELECT/INSERT/UPDATE/DELETE WHERE company_id = auth.jwt() -> 'company_id'`
- User roles: admin, účtovník, fakturant, mzdár, skladník, readonly
- Granulárne oprávnenia (čítanie / zápis / mazanie per modul)
- Superadmin role (Supabase service key – len pre migrácie a údržbu)

### 21.5 Supabase Storage:
- Bucket `documents` – nahrané doklady (faktúry, bločky, bankové výpisy, zmluvy)
- Bucket `generated` – generované PDF (faktúry, výkazy, výplatné pásky)
- Bucket `logos` – logá a pečiatky firiem
- Bucket `exports` – exportované súbory (XML, XLSX, ZIP)
- Bucket `backups` – zálohy dát
- Storage policies: prístup len k vlastnej firme
- Maximálna veľkosť súboru: 10MB (dokumenty), 2MB (logá)
- Povolené formáty: JPG, JPEG, PNG, PDF, HEIC, TIFF, WEBP, XML, CSV, XLSX, MT940, OFX

### 21.6 Bezpečnosť:
- HTTPS everywhere
- Supabase Auth (email/password, magic link)
- JWT tokeny s custom claims (company_id, role)
- CSRF ochrana
- Rate limiting na API routes
- Input validácia (Zod) na frontend aj backend
- Prepared statements (SQL injection ochrana cez Supabase client)
- XSS ochrana (React default escaping + DOMPurify pre HTML)
- Content Security Policy headers
- Šifrovanie citlivých údajov (pgcrypto – rodné čísla, bankové účty)
- Bezpečné uloženie API kľúčov (environment variables)
- 2FA (voliteľné – TOTP cez authenticator app)
- Session management (max session duration, force logout)
- Password policy (min. 8 znakov, číslo, veľké písmeno)

---

## 22. UI/UX POŽIADAVKY

- Čistý, profesionálny **minimalistický dizajn** (žiadne zbytočné dekorácie, tieňovanie, gradienty)
- Slovenský jazyk celej aplikácie (všetky labely, hlášky, chybové správy, tooltips)
- **Dark / light mode** (system preference + manuálne prepínanie)
- Responsive: **desktop-first**, ale plne funkčný na mobile a tablete
- **Sidebar navigácia** (zbaliteľná, sticky) s modulmi:
  - 🏠 Dashboard
  - 📄 Fakturácia (odoslané, prijaté, zálohové, cenové ponuky)
  - 📒 Účtovníctvo (denník, hlavná kniha, predkontácie, účtový rozvrh)
  - 🏦 Banka (výpisy, párovanie, príkazy)
  - 💰 Pokladňa
  - 📦 Sklad
  - 👥 Mzdy
  - 🚗 Cestovné príkazy
  - 📊 Dane (DPH, KV, SV, DP)
  - 📋 Závierka
  - 📈 Reporty
  - 👤 Kontakty
  - 🏢 Majetok
  - ⚙️ Nastavenia
  - 🤖 AI Asistent
- **Breadcrumb** navigácia
- **Klávesové skratky** (Ctrl+N nová faktúra, Ctrl+S uložiť, Ctrl+P tlačiť, Ctrl+F hľadať, Esc zavrieť modal)
- **Command palette** (Ctrl+K) – rýchle vyhľadávanie a navigácia
- **Toast notifikácie** (success, error, warning, info)
- Modálne dialógy pre rýchle akcie
- Tabuľky s:
  - Vyhľadávaním (fulltext)
  - Filtrovaním (multi-select, dátumový rozsah, sumy od-do)
  - Triedením (klik na stĺpec)
  - Stránkovaním (cursor-based)
  - Exportom (PDF, XLSX, CSV)
  - Výberom stĺpcov (toggle viditeľnosť)
  - Hromadnými akciami (select all, bulk actions)
- Inline editácia kde je to vhodné
- **Skeleton loading** states
- **Empty states** s call-to-action ("Zatiaľ nemáte žiadne faktúry. Vytvoriť prvú?")
- **Onboarding wizard** pre novú firmu:
  1. Údaje firmy (IČO → automatické doplnenie)
  2. Typ účtovníctva (PÚ / JÚ)
  3. Bankové účty
  4. Logo a pečiatka
  5. Účtový rozvrh (predvolený alebo import)
  6. Číselné rady dokladov
  7. DPH nastavenia (platiteľ / neplatiteľ, obdobie)
  8. SMTP nastavenia (email)
- **Multi-tab podpora** (otvorenie faktúry v novej záložke)
- **Print-friendly** verzie výkazov (media queries @print)
- **Drag & drop** pre:
  - Nahrávanie súborov
  - Párovanie platieb
  - Dashboard widgety
  - Poradie položiek na faktúre
- Accessibility (ARIA labels, keyboard navigation, screen reader support)

---

## 23. PORADIE IMPLEMENTÁCIE

Implementuj v tomto poradí. Každý krok otestuj pred pokračovaním. Po každej fáze zhrň čo bolo implementované.

### Fáza 1 – Základ (závisí na: nič):
1. **Databázová schéma** – všetky tabuľky, RLS, indexy, funkcie, triggery, migrácie
2. **Autentifikácia** – registrácia, prihlásenie, Supabase Auth, JWT, správa sessions
3. **Multi-company** – vytvorenie firmy, prepínanie medzi firmami, onboarding wizard
4. **Roles & Permissions** – role, oprávnenia, middleware kontrola
5. **Layout** – sidebar, header, breadcrumb, command palette, dark/light mode

### Fáza 2 – Kontakty a Fakturácia (závisí na: Fáza 1):
6. **Kontakty** – CRUD, IČO doplnenie (ORSR API), VIES overenie, DPH zoznam, insolvencia
7. **Odoslané faktúry** – CRUD, položky, PDF generovanie, QR PAY by square, číslovanie, stavy
8. **Zálohové a proforma faktúry** – vyúčtovanie záloh
9. **Dobropisy** – opravné faktúry s väzbou na pôvodnú
10. **Prijaté faktúry** – manuálne zadávanie
11. **Opakujúce sa faktúry** – šablóny, automatické generovanie (cron)
12. **Cenové ponuky a objednávky** – CRUD, konverzia na faktúru

### Fáza 3 – OCR a AI (závisí na: Fáza 2):
13. **OCR modul** – upload JPG/PNG/PDF, Claude Vision API extrakcia, split view, korekcia
14. **AI predkontácie** – automatický návrh účtovania z dokladu
15. **AI chatbot** – integrovaný asistent s prístupom k dátam firmy
16. **AI anomaly detection** – detekcia neobvyklých transakcií

### Fáza 4 – Účtovníctvo (závisí na: Fáza 2, 3):
17. **Účtový rozvrh** – prednastavený SK rozvrh, analytické účty, import/export
18. **Účtovné zápisy** – denník, MD/D, predkontácie, automatické účtovanie faktúr
19. **Hlavná kniha** – zostatky, obraty, filtrovanie
20. **Obratová predvaha** – kontrola MD = D
21. **Saldokonto** – odberateľské, dodávateľské, aging
22. **Pokladňa** – PPD, VPD, pokladničná kniha
23. **Časové rozlíšenie, opravné položky, rezervy** – interné doklady

### Fáza 5 – Banka (závisí na: Fáza 4):
24. **Bankový modul** – import MT940/camt.053/CSV, multi-bank
25. **Párovanie platieb** – automatické + manuálne, pravidlá
26. **Automatické účtovanie** bankových pohybov
27. **Bankové príkazy** – SEPA XML pain.001

### Fáza 6 – Dane (závisí na: Fáza 4, 5):
28. **DPH priznanie** – výpočet + XML export podľa XSD
29. **Kontrolný výkaz DPH** – oddiely A-D + XML export
30. **Súhrnný výkaz** – XML export
31. **Daňové priznanie DPPO** – výpočet + XML
32. **Daňové priznanie DPFO typ B** – výpočet + XML
33. **Daňové odpisy** – evidencia, odpisové skupiny, porovnanie s účtovnými
34. **OSS** – evidencia B2C EÚ predajov (ak relevantné)
35. **Intrastat** – hlásenia o pohybe tovaru v EÚ

### Fáza 7 – Závierka (závisí na: Fáza 4, 5, 6):
36. **Prípravný checklist** – interaktívny zoznam uzávierkových krokov
37. **Uzávierkové operácie** – 710, 702, 701, kurzové rozdiely, OP, rezervy, ČR
38. **Súvaha + Výkaz Z/S** – generovanie podľa vzoru MF SR
39. **Poznámky k závierke** – šablóna + AI generovanie
40. **XML pre RÚZ** – export účtovnej závierky
41. **Uzavretie/otvorenie obdobia** – zamknutie, počiatočné stavy

### Fáza 8 – Jednoduché účtovníctvo (závisí na: Fáza 1, 2):
42. **Peňažný denník** – príjmy, výdavky, kategórie
43. **Pomocné knihy** – pohľadávky, záväzky, DPH, majetok
44. **Výkazy JÚ** – výkaz o príjmoch a výdavkoch, výkaz o majetku a záväzkoch

### Fáza 9 – Rozšírenia (závisí na: Fáza 4):
45. **Majetok a odpisy** – karty, zaradenie, vyradenie, odpisové plány
46. **Sklad** – príjemky, výdajky, inventúra, skladové karty, prepojenie s fakturáciou
47. **Mzdy** – zamestnanci, výpočet miezd, výplatné pásky, hlásenia XML
48. **Cestovné príkazy** – tuzemské, zahraničné, vyúčtovanie

### Fáza 10 – Multi-mena a Integrácie (závisí na: Fáza 4, 5):
49. **Multi-mena** – kurzový lístok ECB/NBS, prepočty, kurzové rozdiely
50. **E-faktúra** – UBL 2.1 export/import
51. **Import z Pohoda/SuperFaktúra/Money** – wizard s mapovaním
52. **REST API** – autentifikácia, endpointy, dokumentácia
53. **Webhooky** – konfigurácia, odosielanie, logy
54. **eKasa integrácia** – import denných uzávierok

### Fáza 11 – Portál a Platby (závisí na: Fáza 2):
55. **Klientský portál** – login odberateľov, prehľad faktúr
56. **Online platby** – Stripe, GoPay, automatické párovanie
57. **Platobné linky v emailoch** – s QR kódom

### Fáza 12 – Finalizácia (závisí na: všetky predchádzajúce):
58. **Reporting** – aging, cash flow prognóza, finančné ukazovatele, AI predikcie
59. **Dashboard** – kompletný s konfigurovateľnými widgetmi
60. **Notifikačný systém** – email + in-app + push
61. **Archivácia a audit trail** – história zmien, zálohovanie, GDPR
62. **Konsolidovaná závierka** – pre skupiny firiem
63. **Transfer pricing** – evidencia kontrolovaných transakcií
64. **PWA** – mobilná verzia, offline, camera API
65. **Onboarding** – finálny wizard, demo dáta, help center

---

## 24. KRITICKÉ PRAVIDLÁ PRE IMPLEMENTÁCIU

### Účtovné pravidlá (MUSIA byť dodržané):
1. **Podvojnosť** – každý zápis MUSÍ mať MD = D (systém NESMIE uložiť nevyvážený zápis)
2. **Chronológia** – zápisy musia byť v chronologickom poradí v rámci obdobia
3. **Nemeniteľnosť** – zaúčtovaný doklad v uzavretom období sa NESMIE editovať (len storno + nový zápis)
4. **Kompletnosť** – ku každému účtovnému zápisu MUSÍ existovať doklad
5. **Kontinuita** – konečné zostatky = počiatočné zostatky nasledujúceho obdobia
6. **Bilancie** – Aktíva MUSIA sa rovnať Pasívam (kontrola pri generovaní súvahy)
7. **DPH** – DPH na vstupe sa odpočíta len ak existuje daňový doklad (§51)
8. **Číselné rady** – neprerušovaná postupnosť čísiel dokladov v rámci roka

### Technické pravidlá:
1. Všetky sumy zaokrúhľovať na **2 desatinné miesta** (EUR)
2. DPH výpočet: základ × sadzba, zaokrúhlenie podľa §26 zákona o DPH (matematicky)
3. XML súbory MUSIA byť validné voči aktuálnym **XSD schémam Finančnej správy SR** (2025)
4. Používať **TypeScript** strict mode všade
5. **Zod** validácia na frontende aj backende (zdieľané schémy)
6. Každý API route: autentifikácia → autorizácia → validácia → business logic → response
7. Všetky dátumy v timezone **Europe/Bratislava** (display) a **UTC** (storage)
8. Database: **UUID** pre PK, **TIMESTAMPTZ** pre dátumy, **NUMERIC(15,2)** pre sumy
9. Soft delete (stĺpec `deleted_at`) pre všetky dôležité záznamy
10. Optimistic locking (stĺpec `version` alebo `updated_at` check) pre concurrent edits
11. Error handling s **user-friendly správami v slovenčine**
12. Loading states pre všetky async operácie
13. Stránkovanie pre veľké datasety (**cursor-based** pagination)
14. **Rate limiting** na všetky API routes
15. **Logging** – štruktúrovaný log (JSON) pre debugovanie

### Testovanie:
1. Účtovné výpočty – unit testy pre všetky výpočty (DPH, mzdy, odpisy, kurzové rozdiely)
2. XML validácia – testy voči XSD schémam
3. RLS – testy že firma A nevidí dáta firmy B
4. Edge cases – nulové sumy, záporné sumy (dobropisy), veľké sumy, cudzie meny
5. Dátumové edge cases – prestupné roky, zmena roku, zmena sadzby DPH

---

Začni implementáciou **Fázy 1** (databázová schéma, auth, multi-company). Pred každou fázou si prečítaj relevantnú legislatívu a overte správnosť účtovných postupov. Po každej fáze zhrň čo bolo implementované a opýtaj sa na pokračovanie. Pracuj systematicky, modul po module, s dôrazom na kvalitu a správnosť.
