import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

interface SeedAccount {
  synteticky_ucet: string
  nazov: string
  typ: "aktivny" | "pasivny" | "vynosovy" | "nakladovy"
  podsuvahovovy?: boolean
}

// Standard Slovak chart of accounts based on Opatrenie MF SR c. 23054/2002-92
const standardAccounts: SeedAccount[] = [
  // ===== Trieda 0 - Dlhodoby majetok =====
  { synteticky_ucet: "011", nazov: "Zriadovacie naklady", typ: "aktivny" },
  { synteticky_ucet: "012", nazov: "Aktivovane naklady na vyvoj", typ: "aktivny" },
  { synteticky_ucet: "013", nazov: "Softver", typ: "aktivny" },
  { synteticky_ucet: "014", nazov: "Ocenitelne prava", typ: "aktivny" },
  { synteticky_ucet: "015", nazov: "Goodwill", typ: "aktivny" },
  { synteticky_ucet: "019", nazov: "Ostatny dlhodoby nehmotny majetok", typ: "aktivny" },
  { synteticky_ucet: "021", nazov: "Stavby", typ: "aktivny" },
  { synteticky_ucet: "022", nazov: "Samostatne hnutelne veci a subory hnutelnych veci", typ: "aktivny" },
  { synteticky_ucet: "023", nazov: "Dopravne prostriedky", typ: "aktivny" },
  { synteticky_ucet: "025", nazov: "Pestovatelske celky trvalych porastov", typ: "aktivny" },
  { synteticky_ucet: "026", nazov: "Zakladne stado a tazne zvierata", typ: "aktivny" },
  { synteticky_ucet: "029", nazov: "Ostatny dlhodoby hmotny majetok", typ: "aktivny" },
  { synteticky_ucet: "031", nazov: "Pozemky", typ: "aktivny" },
  { synteticky_ucet: "032", nazov: "Umelecke diela a zbierky", typ: "aktivny" },
  { synteticky_ucet: "041", nazov: "Obstaranie dlhodobeho nehmotneho majetku", typ: "aktivny" },
  { synteticky_ucet: "042", nazov: "Obstaranie dlhodobeho hmotneho majetku", typ: "aktivny" },
  { synteticky_ucet: "043", nazov: "Obstaranie dlhodobeho financneho majetku", typ: "aktivny" },
  { synteticky_ucet: "051", nazov: "Poskytnute preddavky na dlhodoby nehmotny majetok", typ: "aktivny" },
  { synteticky_ucet: "052", nazov: "Poskytnute preddavky na dlhodoby hmotny majetok", typ: "aktivny" },
  { synteticky_ucet: "053", nazov: "Poskytnute preddavky na dlhodoby financny majetok", typ: "aktivny" },
  { synteticky_ucet: "061", nazov: "Podielove cenne papiere a podiely v dcerskej uct. jednotke", typ: "aktivny" },
  { synteticky_ucet: "062", nazov: "Podielove cenne papiere a podiely v spolocnosti s podstatnym vplyvom", typ: "aktivny" },
  { synteticky_ucet: "063", nazov: "Realizovatelne cenne papiere a podiely", typ: "aktivny" },
  { synteticky_ucet: "065", nazov: "Dlhove cenne papiere drzane do splatnosti", typ: "aktivny" },
  { synteticky_ucet: "066", nazov: "Pozicky uct. jednotkam v konsolidovanom celku", typ: "aktivny" },
  { synteticky_ucet: "067", nazov: "Ostatne pozicky", typ: "aktivny" },
  { synteticky_ucet: "069", nazov: "Ostatny dlhodoby financny majetok", typ: "aktivny" },
  // Opravky k dlhodobemu nehmotnemu majetku
  { synteticky_ucet: "071", nazov: "Opravky k zriadovacim nakladom", typ: "pasivny" },
  { synteticky_ucet: "072", nazov: "Opravky k aktivovanym nakladom na vyvoj", typ: "pasivny" },
  { synteticky_ucet: "073", nazov: "Opravky k softveru", typ: "pasivny" },
  { synteticky_ucet: "074", nazov: "Opravky k ocenitelnym pravam", typ: "pasivny" },
  { synteticky_ucet: "075", nazov: "Opravky ku goodwillu", typ: "pasivny" },
  { synteticky_ucet: "079", nazov: "Opravky k ostatnemu dlhodobemu nehmotnemu majetku", typ: "pasivny" },
  // Opravky k dlhodobemu hmotnemu majetku
  { synteticky_ucet: "081", nazov: "Opravky k stavbam", typ: "pasivny" },
  { synteticky_ucet: "082", nazov: "Opravky k samostatnym hnutelnym veciam a suborom hnutelnych veci", typ: "pasivny" },
  { synteticky_ucet: "083", nazov: "Opravky k dopravnym prostriedkom", typ: "pasivny" },
  { synteticky_ucet: "085", nazov: "Opravky k pestovatelskym celkom trvalych porastov", typ: "pasivny" },
  { synteticky_ucet: "086", nazov: "Opravky k zakladnemu stadu a taznym zvieratam", typ: "pasivny" },
  { synteticky_ucet: "089", nazov: "Opravky k ostatnemu dlhodobemu hmotnemu majetku", typ: "pasivny" },
  // Opravne polozky k dlhodobemu majetku
  { synteticky_ucet: "091", nazov: "Opravne polozky k dlhodobemu nehmotnemu majetku", typ: "pasivny" },
  { synteticky_ucet: "092", nazov: "Opravne polozky k dlhodobemu hmotnemu majetku", typ: "pasivny" },
  { synteticky_ucet: "093", nazov: "Opravne polozky k nedokoncenemu dlhodobemu nehmotnemu majetku", typ: "pasivny" },
  { synteticky_ucet: "094", nazov: "Opravne polozky k nedokoncenemu dlhodobemu hmotnemu majetku", typ: "pasivny" },
  { synteticky_ucet: "095", nazov: "Opravne polozky k poskytnutym preddavkom na dlhodoby majetok", typ: "pasivny" },
  { synteticky_ucet: "096", nazov: "Opravne polozky k dlhodobemu financnemu majetku", typ: "pasivny" },
  { synteticky_ucet: "097", nazov: "Opravne polozky k nadobudnutemu majetku", typ: "pasivny" },
  { synteticky_ucet: "098", nazov: "Opravne polozky k ostatnemu dlhodobemu majetku", typ: "pasivny" },

  // ===== Trieda 1 - Zasoby =====
  { synteticky_ucet: "111", nazov: "Obstaranie materialu", typ: "aktivny" },
  { synteticky_ucet: "112", nazov: "Material na sklade", typ: "aktivny" },
  { synteticky_ucet: "119", nazov: "Material na ceste", typ: "aktivny" },
  { synteticky_ucet: "121", nazov: "Nedokoncena vyroba", typ: "aktivny" },
  { synteticky_ucet: "122", nazov: "Polotovary vlastnej vyroby", typ: "aktivny" },
  { synteticky_ucet: "123", nazov: "Vyrobky", typ: "aktivny" },
  { synteticky_ucet: "124", nazov: "Zvierata", typ: "aktivny" },
  { synteticky_ucet: "131", nazov: "Obstaranie tovaru", typ: "aktivny" },
  { synteticky_ucet: "132", nazov: "Tovar na sklade a v predajniach", typ: "aktivny" },
  { synteticky_ucet: "139", nazov: "Tovar na ceste", typ: "aktivny" },
  // Opravne polozky k zasobam
  { synteticky_ucet: "191", nazov: "Opravne polozky k materialu", typ: "pasivny" },
  { synteticky_ucet: "192", nazov: "Opravne polozky k nedokoncenej vyrobe", typ: "pasivny" },
  { synteticky_ucet: "193", nazov: "Opravne polozky k polotovarom vlastnej vyroby", typ: "pasivny" },
  { synteticky_ucet: "194", nazov: "Opravne polozky k vyrobkom", typ: "pasivny" },
  { synteticky_ucet: "195", nazov: "Opravne polozky k zvieratam", typ: "pasivny" },
  { synteticky_ucet: "196", nazov: "Opravne polozky k tovaru", typ: "pasivny" },

  // ===== Trieda 2 - Financne ucty =====
  { synteticky_ucet: "211", nazov: "Pokladna", typ: "aktivny" },
  { synteticky_ucet: "213", nazov: "Ceniny", typ: "aktivny" },
  { synteticky_ucet: "221", nazov: "Bankove ucty", typ: "aktivny" },
  { synteticky_ucet: "231", nazov: "Kratkodobe bankove uvery", typ: "pasivny" },
  { synteticky_ucet: "232", nazov: "Eskontne uvery", typ: "pasivny" },
  { synteticky_ucet: "241", nazov: "Kratkodobe financne vypomoci", typ: "pasivny" },
  { synteticky_ucet: "249", nazov: "Ostatne kratkodobe financne vypomoci", typ: "pasivny" },
  { synteticky_ucet: "251", nazov: "Majetkove cenne papiere na obchodovanie", typ: "aktivny" },
  { synteticky_ucet: "252", nazov: "Vlastne akcie a vlastne obchodne podiely", typ: "aktivny" },
  { synteticky_ucet: "253", nazov: "Dlhove cenne papiere na obchodovanie", typ: "aktivny" },
  { synteticky_ucet: "255", nazov: "Vlastne dlhopisy", typ: "aktivny" },
  { synteticky_ucet: "256", nazov: "Ostatne realizovatelne cenne papiere", typ: "aktivny" },
  { synteticky_ucet: "259", nazov: "Obstaranie kratkodobeho financneho majetku", typ: "aktivny" },
  { synteticky_ucet: "261", nazov: "Peniaze na ceste", typ: "aktivny" },
  { synteticky_ucet: "291", nazov: "Opravne polozky ku kratkodobemu financnemu majetku", typ: "pasivny" },

  // ===== Trieda 3 - Zuctovacie vztahy =====
  { synteticky_ucet: "311", nazov: "Odberatelia", typ: "aktivny" },
  { synteticky_ucet: "312", nazov: "Zmenky na inkaso", typ: "aktivny" },
  { synteticky_ucet: "313", nazov: "Pohladavky za eskontovane cenné papiere", typ: "aktivny" },
  { synteticky_ucet: "314", nazov: "Poskytnute preddavky", typ: "aktivny" },
  { synteticky_ucet: "315", nazov: "Ostatne pohladavky", typ: "aktivny" },
  { synteticky_ucet: "316", nazov: "Cista hodnota zakazky", typ: "aktivny" },
  { synteticky_ucet: "321", nazov: "Dodavatelia", typ: "pasivny" },
  { synteticky_ucet: "322", nazov: "Zmenky na uhradu", typ: "pasivny" },
  { synteticky_ucet: "323", nazov: "Kratkodobe rezervy", typ: "pasivny" },
  { synteticky_ucet: "324", nazov: "Prijate preddavky", typ: "pasivny" },
  { synteticky_ucet: "325", nazov: "Ostatne zavazky", typ: "pasivny" },
  { synteticky_ucet: "326", nazov: "Nevyfakturovane dodavky", typ: "pasivny" },
  { synteticky_ucet: "331", nazov: "Zamestnanci", typ: "pasivny" },
  { synteticky_ucet: "333", nazov: "Ostatne zavazky voci zamestnancom", typ: "pasivny" },
  { synteticky_ucet: "335", nazov: "Pohladavky voci zamestnancom", typ: "aktivny" },
  { synteticky_ucet: "336", nazov: "Zuctovanie s organmi socialneho a zdravotneho poistenia", typ: "pasivny" },
  { synteticky_ucet: "341", nazov: "Dan z prijmov", typ: "pasivny" },
  { synteticky_ucet: "342", nazov: "Ostatne priame dane", typ: "pasivny" },
  { synteticky_ucet: "343", nazov: "Dan z pridanej hodnoty", typ: "aktivny" },
  { synteticky_ucet: "345", nazov: "Ostatne dane a poplatky", typ: "pasivny" },
  { synteticky_ucet: "346", nazov: "Dotacie zo statneho rozpoctu", typ: "aktivny" },
  { synteticky_ucet: "347", nazov: "Ostatne dotacie", typ: "aktivny" },
  { synteticky_ucet: "351", nazov: "Pohladavky v ramci konsolidovaneho celku", typ: "aktivny" },
  { synteticky_ucet: "353", nazov: "Pohladavky za upísane vlastne imanie", typ: "aktivny" },
  { synteticky_ucet: "354", nazov: "Pohladavky voci spolocnikom a clenom pri uhrade straty", typ: "aktivny" },
  { synteticky_ucet: "355", nazov: "Ostatne pohladavky voci spolocnikom a clenom", typ: "aktivny" },
  { synteticky_ucet: "361", nazov: "Zavazky v ramci konsolidovaneho celku", typ: "pasivny" },
  { synteticky_ucet: "364", nazov: "Zavazky voci spolocnikom a clenom pri rozdeleni zisku", typ: "pasivny" },
  { synteticky_ucet: "365", nazov: "Ostatne zavazky voci spolocnikom a clenom", typ: "pasivny" },
  { synteticky_ucet: "366", nazov: "Zavazky voci spolocnikom a clenom zo zavislej cinnosti", typ: "pasivny" },
  { synteticky_ucet: "367", nazov: "Zavazky z upisanych nesplatenych cennych papierov a vkladov", typ: "pasivny" },
  { synteticky_ucet: "371", nazov: "Pohladavky z predaja podniku", typ: "aktivny" },
  { synteticky_ucet: "372", nazov: "Zavazky z kupy podniku", typ: "pasivny" },
  { synteticky_ucet: "373", nazov: "Pohladavky a zavazky z pevnych terminovanych operacii", typ: "aktivny" },
  { synteticky_ucet: "374", nazov: "Pohladavky z najmu", typ: "aktivny" },
  { synteticky_ucet: "375", nazov: "Pohladavky z vydanych dlhopisov", typ: "aktivny" },
  { synteticky_ucet: "376", nazov: "Nakupene opcie", typ: "aktivny" },
  { synteticky_ucet: "377", nazov: "Predane opcie", typ: "pasivny" },
  { synteticky_ucet: "378", nazov: "Ine pohladavky", typ: "aktivny" },
  { synteticky_ucet: "379", nazov: "Ine zavazky", typ: "pasivny" },
  { synteticky_ucet: "381", nazov: "Naklady buducich obdobi", typ: "aktivny" },
  { synteticky_ucet: "382", nazov: "Komplexne naklady buducich obdobi", typ: "aktivny" },
  { synteticky_ucet: "383", nazov: "Vydavky buducich obdobi", typ: "pasivny" },
  { synteticky_ucet: "384", nazov: "Vynosy buducich obdobi", typ: "pasivny" },
  { synteticky_ucet: "385", nazov: "Prijmy buducich obdobi", typ: "aktivny" },
  { synteticky_ucet: "388", nazov: "Dohadne ucty aktivne", typ: "aktivny" },
  { synteticky_ucet: "389", nazov: "Dohadne ucty pasivne", typ: "pasivny" },
  { synteticky_ucet: "391", nazov: "Opravne polozky k pohladavkam", typ: "pasivny" },
  { synteticky_ucet: "395", nazov: "Vnutorne zuctovanie", typ: "aktivny" },
  { synteticky_ucet: "398", nazov: "Spojovaci ucet pri zdruzeni", typ: "aktivny" },

  // ===== Trieda 4 - Kapitalove ucty a dlhodobe zavazky =====
  { synteticky_ucet: "411", nazov: "Zakladne imanie", typ: "pasivny" },
  { synteticky_ucet: "412", nazov: "Emisne azio", typ: "pasivny" },
  { synteticky_ucet: "413", nazov: "Ostatne kapitalove fondy", typ: "pasivny" },
  { synteticky_ucet: "414", nazov: "Ocenovacie rozdiely z precenenia majetku a zavazkov", typ: "pasivny" },
  { synteticky_ucet: "415", nazov: "Ocenovacie rozdiely z kapitalovych ucastin", typ: "pasivny" },
  { synteticky_ucet: "416", nazov: "Ocenovacie rozdiely z precenenia pri zluceni, splynutí a rozdeleni", typ: "pasivny" },
  { synteticky_ucet: "417", nazov: "Zakonny rezervny fond z kapitalovych vkladov", typ: "pasivny" },
  { synteticky_ucet: "418", nazov: "Nedelitelny fond z kapitalovych vkladov", typ: "pasivny" },
  { synteticky_ucet: "419", nazov: "Zmeny zakladneho imania", typ: "pasivny" },
  { synteticky_ucet: "421", nazov: "Zakonny rezervny fond", typ: "pasivny" },
  { synteticky_ucet: "422", nazov: "Nedelitelny fond", typ: "pasivny" },
  { synteticky_ucet: "423", nazov: "Statutarne fondy", typ: "pasivny" },
  { synteticky_ucet: "427", nazov: "Ostatne fondy", typ: "pasivny" },
  { synteticky_ucet: "428", nazov: "Nerozdeleny zisk minulych rokov", typ: "pasivny" },
  { synteticky_ucet: "429", nazov: "Neuhradena strata minulych rokov", typ: "pasivny" },
  { synteticky_ucet: "431", nazov: "Vysledok hospodarenia v schvalovani", typ: "pasivny" },
  { synteticky_ucet: "451", nazov: "Rezervy zakonne", typ: "pasivny" },
  { synteticky_ucet: "453", nazov: "Rezervy statutarne", typ: "pasivny" },
  { synteticky_ucet: "459", nazov: "Ostatne rezervy", typ: "pasivny" },
  { synteticky_ucet: "461", nazov: "Bankove uvery", typ: "pasivny" },
  { synteticky_ucet: "471", nazov: "Dlhodobe zavazky v ramci konsolidovaneho celku", typ: "pasivny" },
  { synteticky_ucet: "472", nazov: "Zavazky zo socialneho fondu", typ: "pasivny" },
  { synteticky_ucet: "473", nazov: "Vydane dlhopisy", typ: "pasivny" },
  { synteticky_ucet: "474", nazov: "Zavazky z prenajmu", typ: "pasivny" },
  { synteticky_ucet: "475", nazov: "Dlhodobe prijate preddavky", typ: "pasivny" },
  { synteticky_ucet: "476", nazov: "Dlhodobe nevyfakturovane dodavky", typ: "pasivny" },
  { synteticky_ucet: "478", nazov: "Dlhodobe zmenky na uhradu", typ: "pasivny" },
  { synteticky_ucet: "479", nazov: "Ostatne dlhodobe zavazky", typ: "pasivny" },
  { synteticky_ucet: "481", nazov: "Odlozeny danovy zavazok a odlozena danova pohladavka", typ: "pasivny" },
  { synteticky_ucet: "491", nazov: "Vlastne imanie fyzickej osoby - podnikatela", typ: "pasivny" },

  // ===== Trieda 5 - Naklady =====
  { synteticky_ucet: "501", nazov: "Spotreba materialu", typ: "nakladovy" },
  { synteticky_ucet: "502", nazov: "Spotreba energie", typ: "nakladovy" },
  { synteticky_ucet: "503", nazov: "Spotreba ostatnych neskladovatelnych dodavok", typ: "nakladovy" },
  { synteticky_ucet: "504", nazov: "Predany tovar", typ: "nakladovy" },
  { synteticky_ucet: "505", nazov: "Tvorba a zuctovanie opravnych poloziek k zasobam", typ: "nakladovy" },
  { synteticky_ucet: "507", nazov: "Predana nehnutelnost", typ: "nakladovy" },
  { synteticky_ucet: "511", nazov: "Opravy a udrzovanie", typ: "nakladovy" },
  { synteticky_ucet: "512", nazov: "Cestovne", typ: "nakladovy" },
  { synteticky_ucet: "513", nazov: "Naklady na reprezentaciu", typ: "nakladovy" },
  { synteticky_ucet: "518", nazov: "Ostatne sluzby", typ: "nakladovy" },
  { synteticky_ucet: "521", nazov: "Mzdove naklady", typ: "nakladovy" },
  { synteticky_ucet: "522", nazov: "Prijem spolocnikov a clenov zo zavislej cinnosti", typ: "nakladovy" },
  { synteticky_ucet: "523", nazov: "Odmeny clenom organov spolocnosti a druzstva", typ: "nakladovy" },
  { synteticky_ucet: "524", nazov: "Zakonne socialne poistenie", typ: "nakladovy" },
  { synteticky_ucet: "525", nazov: "Ostatne socialne poistenie", typ: "nakladovy" },
  { synteticky_ucet: "526", nazov: "Socialne naklady fyzickej osoby - podnikatela", typ: "nakladovy" },
  { synteticky_ucet: "527", nazov: "Zakonne socialne naklady", typ: "nakladovy" },
  { synteticky_ucet: "528", nazov: "Ostatne socialne naklady", typ: "nakladovy" },
  { synteticky_ucet: "531", nazov: "Dan z motorovych vozidiel", typ: "nakladovy" },
  { synteticky_ucet: "532", nazov: "Dan z nehnutelnosti", typ: "nakladovy" },
  { synteticky_ucet: "538", nazov: "Ostatne dane a poplatky", typ: "nakladovy" },
  { synteticky_ucet: "541", nazov: "Zostatkova cena predaneho dlhodobeho nehmotneho a hmotneho majetku", typ: "nakladovy" },
  { synteticky_ucet: "542", nazov: "Predany material", typ: "nakladovy" },
  { synteticky_ucet: "543", nazov: "Dary", typ: "nakladovy" },
  { synteticky_ucet: "544", nazov: "Zmluvne pokuty, penale a uroky z omeskania", typ: "nakladovy" },
  { synteticky_ucet: "545", nazov: "Ostatne pokuty, penale a uroky z omeskania", typ: "nakladovy" },
  { synteticky_ucet: "546", nazov: "Odpis pohladavky", typ: "nakladovy" },
  { synteticky_ucet: "547", nazov: "Tvorba a zuctovanie opravnych poloziek k pohladavkam", typ: "nakladovy" },
  { synteticky_ucet: "548", nazov: "Ostatne naklady na hospodarsku cinnost", typ: "nakladovy" },
  { synteticky_ucet: "549", nazov: "Manka a skody", typ: "nakladovy" },
  { synteticky_ucet: "551", nazov: "Odpisy dlhodobeho nehmotneho majetku a dlhodobeho hmotneho majetku", typ: "nakladovy" },
  { synteticky_ucet: "552", nazov: "Tvorba a zuctovanie rezerv", typ: "nakladovy" },
  { synteticky_ucet: "553", nazov: "Tvorba a zuctovanie opravnych poloziek k dlhodobemu majetku", typ: "nakladovy" },
  { synteticky_ucet: "555", nazov: "Zuctovanie komplexnych nakladov buducich obdobi", typ: "nakladovy" },
  { synteticky_ucet: "557", nazov: "Zuctovanie opravky k opravnej polozke k nadobudnutemu majetku", typ: "nakladovy" },
  { synteticky_ucet: "558", nazov: "Tvorba a zuctovanie opravnych poloziek k zasobam", typ: "nakladovy" },
  { synteticky_ucet: "561", nazov: "Predane cenne papiere a podiely", typ: "nakladovy" },
  { synteticky_ucet: "562", nazov: "Uroky", typ: "nakladovy" },
  { synteticky_ucet: "563", nazov: "Kurzove straty", typ: "nakladovy" },
  { synteticky_ucet: "564", nazov: "Naklady na precenenie cennych papierov", typ: "nakladovy" },
  { synteticky_ucet: "565", nazov: "Naklady na kratkodoby financny majetok", typ: "nakladovy" },
  { synteticky_ucet: "566", nazov: "Naklady na dlhodoby financny majetok", typ: "nakladovy" },
  { synteticky_ucet: "567", nazov: "Naklady na derivatove operacie", typ: "nakladovy" },
  { synteticky_ucet: "568", nazov: "Ostatne financne naklady", typ: "nakladovy" },
  { synteticky_ucet: "569", nazov: "Manka a skody na financnom majetku", typ: "nakladovy" },
  { synteticky_ucet: "574", nazov: "Tvorba a zuctovanie opravnych poloziek k financnemu majetku", typ: "nakladovy" },
  { synteticky_ucet: "575", nazov: "Tvorba a zuctovanie rezerv", typ: "nakladovy" },
  { synteticky_ucet: "591", nazov: "Dan z prijmov - splatna", typ: "nakladovy" },
  { synteticky_ucet: "592", nazov: "Dan z prijmov - odlozena", typ: "nakladovy" },
  { synteticky_ucet: "595", nazov: "Dodatocne odvody dane z prijmov", typ: "nakladovy" },

  // ===== Trieda 6 - Vynosy =====
  { synteticky_ucet: "601", nazov: "Trzby za vlastne vyrobky", typ: "vynosovy" },
  { synteticky_ucet: "602", nazov: "Trzby z predaja sluzieb", typ: "vynosovy" },
  { synteticky_ucet: "604", nazov: "Trzby za tovar", typ: "vynosovy" },
  { synteticky_ucet: "606", nazov: "Vynosy z nehnutelnosti na predaj", typ: "vynosovy" },
  { synteticky_ucet: "607", nazov: "Vynosy z nehnutelnosti na predaj", typ: "vynosovy" },
  { synteticky_ucet: "611", nazov: "Zmena stavu nedokoncenej vyroby", typ: "vynosovy" },
  { synteticky_ucet: "612", nazov: "Zmena stavu polotovarov", typ: "vynosovy" },
  { synteticky_ucet: "613", nazov: "Zmena stavu vyrobkov", typ: "vynosovy" },
  { synteticky_ucet: "614", nazov: "Zmena stavu zvierat", typ: "vynosovy" },
  { synteticky_ucet: "621", nazov: "Aktivacia materialu a tovaru", typ: "vynosovy" },
  { synteticky_ucet: "622", nazov: "Aktivacia vnutroorganizacnych sluzieb", typ: "vynosovy" },
  { synteticky_ucet: "623", nazov: "Aktivacia dlhodobeho nehmotneho majetku", typ: "vynosovy" },
  { synteticky_ucet: "624", nazov: "Aktivacia dlhodobeho hmotneho majetku", typ: "vynosovy" },
  { synteticky_ucet: "641", nazov: "Trzby z predaja dlhodobeho nehmotneho a hmotneho majetku", typ: "vynosovy" },
  { synteticky_ucet: "642", nazov: "Trzby z predaja materialu", typ: "vynosovy" },
  { synteticky_ucet: "644", nazov: "Zmluvne pokuty, penale a uroky z omeskania", typ: "vynosovy" },
  { synteticky_ucet: "645", nazov: "Ostatne pokuty, penale a uroky z omeskania", typ: "vynosovy" },
  { synteticky_ucet: "646", nazov: "Vynosy z odpisanych pohladavok", typ: "vynosovy" },
  { synteticky_ucet: "648", nazov: "Ostatne vynosy z hospodarskej cinnosti", typ: "vynosovy" },
  { synteticky_ucet: "651", nazov: "Trzby z predaja cennych papierov a podielov", typ: "vynosovy" },
  { synteticky_ucet: "652", nazov: "Vynosy z dlhodobeho financneho majetku", typ: "vynosovy" },
  { synteticky_ucet: "653", nazov: "Trzby z predaja cennych papierov a podielov", typ: "vynosovy" },
  { synteticky_ucet: "654", nazov: "Vynosy z kratkodobeho financneho majetku", typ: "vynosovy" },
  { synteticky_ucet: "655", nazov: "Vynosy z dlhodobeho financneho majetku", typ: "vynosovy" },
  { synteticky_ucet: "656", nazov: "Vynosy z kratkodobeho financneho majetku", typ: "vynosovy" },
  { synteticky_ucet: "661", nazov: "Vynosy z cennych papierov a podielov", typ: "vynosovy" },
  { synteticky_ucet: "662", nazov: "Uroky", typ: "vynosovy" },
  { synteticky_ucet: "663", nazov: "Kurzove zisky", typ: "vynosovy" },
  { synteticky_ucet: "664", nazov: "Vynosy z precenenia cennych papierov", typ: "vynosovy" },
  { synteticky_ucet: "665", nazov: "Vynosy z dlhodobeho financneho majetku", typ: "vynosovy" },
  { synteticky_ucet: "666", nazov: "Vynosy z kratkodobeho financneho majetku", typ: "vynosovy" },
  { synteticky_ucet: "667", nazov: "Vynosy z derivatovych operacii", typ: "vynosovy" },
  { synteticky_ucet: "668", nazov: "Ostatne financne vynosy", typ: "vynosovy" },

  // ===== Trieda 7 - Zavierkove a podsuvahove ucty =====
  { synteticky_ucet: "701", nazov: "Pociatocny ucet suvahovy", typ: "aktivny" },
  { synteticky_ucet: "702", nazov: "Konecny ucet suvahovy", typ: "aktivny" },
  { synteticky_ucet: "710", nazov: "Ucet ziskov a strat", typ: "aktivny" },
  { synteticky_ucet: "791", nazov: "Podsuvahove ucty", typ: "aktivny", podsuvahovovy: true },
  { synteticky_ucet: "792", nazov: "Podsuvahove ucty", typ: "aktivny", podsuvahovovy: true },
  { synteticky_ucet: "793", nazov: "Podsuvahove ucty", typ: "aktivny", podsuvahovovy: true },
  { synteticky_ucet: "794", nazov: "Podsuvahove ucty", typ: "aktivny", podsuvahovovy: true },
  { synteticky_ucet: "795", nazov: "Podsuvahove ucty", typ: "aktivny", podsuvahovovy: true },
  { synteticky_ucet: "796", nazov: "Podsuvahove ucty", typ: "aktivny", podsuvahovovy: true },
  { synteticky_ucet: "797", nazov: "Podsuvahove ucty", typ: "aktivny", podsuvahovovy: true },
  { synteticky_ucet: "798", nazov: "Podsuvahove ucty", typ: "aktivny", podsuvahovovy: true },
  { synteticky_ucet: "799", nazov: "Podsuvahove ucty", typ: "aktivny", podsuvahovovy: true },
]

// POST /api/chart-of-accounts/seed - naplnenie standardneho uctoveho rozvrhu
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Neautorizovany pristup" }, { status: 401 })
  }

  const db = createAdminClient()

  const body = await request.json()
  const { company_id } = body

  if (!company_id) {
    return NextResponse.json({ error: "company_id je povinny" }, { status: 400 })
  }

  // Check if accounts already exist for this company
  const { data: existingAccounts, error: checkError } = await (db.from("chart_of_accounts") as any)
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .is("deleted_at", null) as { data: any; error: any; count?: number }

  if (checkError) {
    return NextResponse.json({ error: checkError.message }, { status: 500 })
  }

  // Prepare accounts for insert
  const accountsToInsert = standardAccounts.map((account) => ({
    synteticky_ucet: account.synteticky_ucet,
    analyticky_ucet: null,
    nazov: account.nazov,
    typ: account.typ,
    danovy: false,
    podsuvahovovy: account.podsuvahovovy || false,
    aktivny: true,
    company_id,
    created_by: user.id,
    updated_by: user.id,
  }))

  // Insert in batches to avoid payload limits
  const batchSize = 50
  let insertedCount = 0
  const errors: string[] = []

  for (let i = 0; i < accountsToInsert.length; i += batchSize) {
    const batch = accountsToInsert.slice(i, i + batchSize)
    const { error: insertError } = await (db.from("chart_of_accounts") as any)
      .upsert(batch, {
        onConflict: "company_id,synteticky_ucet,analyticky_ucet",
        ignoreDuplicates: true,
      })

    if (insertError) {
      // Fallback: try inserting one by one to skip duplicates
      for (const account of batch) {
        const { error: singleError } = await (db.from("chart_of_accounts") as any)
          .insert(account)

        if (singleError) {
          if (!singleError.message.includes("duplicate") && !singleError.message.includes("unique")) {
            errors.push(`${account.synteticky_ucet}: ${singleError.message}`)
          }
        } else {
          insertedCount++
        }
      }
    } else {
      insertedCount += batch.length
    }
  }

  return NextResponse.json({
    success: true,
    message: `Uctovy rozvrh bol naplneny. Vlozených ${insertedCount} uctov.`,
    inserted: insertedCount,
    total: standardAccounts.length,
    errors: errors.length > 0 ? errors : undefined,
  }, { status: 201 })
}
