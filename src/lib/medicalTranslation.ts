/**
 * Diccionario y motor de traducción médica rigurosa para el World Scout Jamboree (WSJ Polonia 2027)
 * Soporta traducción clínica cruzada: Español (Original) -> Inglés (EN) y Polaco (PL).
 */

export interface MedicalDictionaryEntry {
  es: string;
  en: string;
  pl: string;
}

// 1. Grupos Sanguíneos (Blood Groups / Grupy Krwi)
export const BLOOD_TYPES_MAP: Record<string, { es: string; en: string; pl: string }> = {
  'O+': { es: 'O Rh positivo (O+)', en: 'O Rh-positive (O+)', pl: '0 Rh-dodatni (0+)' },
  'O-': { es: 'O Rh negativo (O-)', en: 'O Rh-negative (O-)', pl: '0 Rh-ujemny (0-)' },
  'A+': { es: 'A Rh positivo (A+)', en: 'A Rh-positive (A+)', pl: 'A Rh-dodatni (A+)' },
  'A-': { es: 'A Rh negativo (A-)', en: 'A Rh-negative (A-)', pl: 'A Rh-ujemny (A-)' },
  'B+': { es: 'B Rh positivo (B+)', en: 'B Rh-positive (B+)', pl: 'B Rh-dodatni (B+)' },
  'B-': { es: 'B Rh negativo (B-)', en: 'B Rh-negative (B-)', pl: 'B Rh-ujemny (B-)' },
  'AB+': { es: 'AB Rh positivo (AB+)', en: 'AB Rh-positive (AB+)', pl: 'AB Rh-dodatni (AB+)' },
  'AB-': { es: 'AB Rh negativo (AB-)', en: 'AB Rh-negative (AB-)', pl: 'AB Rh-ujemny (AB-)' },
  'DESCONOCIDO': { es: 'Desconocido / No informado', en: 'Unknown / Not reported', pl: 'Nieznana / Niepodano' },
};

// 2. Diccionario Clínico Especializado (Alergias, Fármacos, Diagnósticos, Dispositivos)
export const CLINICAL_DICTIONARY: MedicalDictionaryEntry[] = [
  // --- ALERGIAS FARMACOLÓGICAS (DRUG ALLERGIES / ALERGIE NA LEKI) ---
  { es: 'penicilina', en: 'Penicillin', pl: 'Penicylina' },
  { es: 'penicilinas', en: 'Penicillins', pl: 'Penicyliny' },
  { es: 'amoxicilina', en: 'Amoxicillin', pl: 'Amoksycylina' },
  { es: 'ampicilina', en: 'Ampicillin', pl: 'Ampicylina' },
  { es: 'cefalosporinas', en: 'Cephalosporins', pl: 'Cefalosporyny' },
  { es: 'sulfas', en: 'Sulfonamides / Sulfa drugs', pl: 'Sulfonamidy' },
  { es: 'sulfamidas', en: 'Sulfonamides', pl: 'Sulfonamidy' },
  { es: 'aines', en: 'NSAIDs (Nonsteroidal anti-inflammatory drugs)', pl: 'NLPZ (Niesteroidowe leki przeciwzapalne)' },
  { es: 'antiinflamatorios', en: 'Anti-inflammatory drugs', pl: 'Leki przeciwzapalne' },
  { es: 'ibuprofeno', en: 'Ibuprofen', pl: 'Ibuprofen' },
  { es: 'aspirina', en: 'Aspirin (Acetylsalicylic acid)', pl: 'Aspiryna (Kwas acetylosalicylowy)' },
  { es: 'ácido acetilsalicílico', en: 'Acetylsalicylic acid', pl: 'Kwas acetylosalicylowy' },
  { es: 'paracetamol', en: 'Paracetamol (Acetaminophen)', pl: 'Paracetamol' },
  { es: 'acetaminofén', en: 'Acetaminophen (Paracetamol)', pl: 'Paracetamol' },
  { es: 'dipirona', en: 'Dipyrone (Metamizole)', pl: 'Metamizol' },
  { es: 'metamizol', en: 'Metamizole', pl: 'Metamizol' },
  { es: 'ketorolaco', en: 'Ketorolac', pl: 'Ketorolak' },
  { es: 'naproxeno', en: 'Naproxen', pl: 'Naproksen' },
  { es: 'diclofenaco', en: 'Diclofenac', pl: 'Diklofenak' },
  { es: 'tramadol', en: 'Tramadol', pl: 'Tramadol' },
  { es: 'morfina', en: 'Morphine', pl: 'Morfina' },
  { es: 'codeína', en: 'Codeine', pl: 'Kodeina' },
  { es: 'anestésicos locales', en: 'Local anesthetics (Lidocaine, Novocaine)', pl: 'Miejscowe środki znieczulające (Lidokaina)' },
  { es: 'lidocaína', en: 'Lidocaine', pl: 'Lidokaina' },
  { es: 'eritromicina', en: 'Erythromycin', pl: 'Erytomycyna' },
  { es: 'azitromicina', en: 'Azithromycin', pl: 'Azytromycyna' },
  { es: 'ciprofloxacino', en: 'Ciprofloxacin', pl: 'Cyprofloksacyna' },
  { es: 'yodo', en: 'Iodine / Radiocontrast agents', pl: 'Jod / Środki kontrastowe jodowe' },
  { es: 'medio de contraste', en: 'Radiographic contrast media', pl: 'Radiologiczne środki kontrastowe' },

  // --- ALERGIAS ALIMENTARIAS Y AMBIENTALES (FOOD & ENVIRONMENTAL ALLERGIES) ---
  { es: 'maní', en: 'Peanuts', pl: 'Orzeszki ziemne' },
  { es: 'mani', en: 'Peanuts', pl: 'Orzeszki ziemne' },
  { es: 'cacahuates', en: 'Peanuts', pl: 'Orzeszki ziemne' },
  { es: 'frutos secos', en: 'Tree nuts (walnuts, almonds, hazelnuts, cashews)', pl: 'Orzechy z drzew orzechowych (włoskie, migdały, nerkowce)' },
  { es: 'nueces', en: 'Walnuts', pl: 'Orzechy włoskie' },
  { es: 'almendras', en: 'Almonds', pl: 'Migdały' },
  { es: 'mariscos', en: 'Shellfish / Crustaceans', pl: 'Owoce morza / Skorupiaki' },
  { es: 'crustáceos', en: 'Crustaceans', pl: 'Skorupiaki' },
  { es: 'moluscos', en: 'Mollusks', pl: 'Mięczaki' },
  { es: 'pescado', en: 'Fish', pl: 'Ryby' },
  { es: 'huevo', en: 'Egg (Egg white/yolk)', pl: 'Jaja kurze (Białko/żółtko)' },
  { es: 'leche de vaca', en: 'Cow milk protein', pl: 'Białko mleka krowiego' },
  { es: 'lácteos', en: 'Dairy products', pl: 'Nabiał' },
  { es: 'lactosa', en: 'Lactose intolerance', pl: 'Nietolerancja laktozy' },
  { es: 'soya', en: 'Soy / Soybeans', pl: 'Soja' },
  { es: 'soja', en: 'Soy / Soybeans', pl: 'Soja' },
  { es: 'trigo', en: 'Wheat', pl: 'Pszenica' },
  { es: 'gluten', en: 'Gluten (Celiac disease/wheat allergy)', pl: 'Gluten (Celiakia / alergia na pszenicę)' },
  { es: 'sésamo', en: 'Sesame seeds', pl: 'Nasiona sezamu' },
  { es: 'mostaza', en: 'Mustard', pl: 'Musztarda / Gorczyca' },
  { es: 'apio', en: 'Celery', pl: 'Seler' },
  { es: 'picadura de abeja', en: 'Bee sting (Hymenoptera venom)', pl: 'Użądlenie pszczoły (jad owadów błonkoskrzydłych)' },
  { es: 'picadura de avispa', en: 'Wasp / Hornet sting venom', pl: 'Użądlenie osy / szerszenia' },
  { es: 'picaduras de insectos', en: 'Insect stings / bites', pl: 'Użądlenia / ukąszenia owadów' },
  { es: 'látex', en: 'Natural rubber latex', pl: 'Lateks kauczuku naturalnego' },
  { es: 'latex', en: 'Natural rubber latex', pl: 'Lateks kauczuku naturalnego' },
  { es: 'polen', en: 'Pollen (seasonal allergic rhinitis)', pl: 'Pyłki roślin (sezonowy nieżyt nosa)' },
  { es: 'ácaros', en: 'Dust mites', pl: 'Roztocza kurzu domowego' },
  { es: 'pelo de gato', en: 'Cat dander', pl: 'Sierść kota' },
  { es: 'pelo de perro', en: 'Dog dander', pl: 'Sierść psa' },

  // --- SEVERIDAD Y EMERGENCIAS (SEVERITY & EMERGENCIES) ---
  { es: 'anafilaxia', en: 'Anaphylaxis (Life-threatening severe systemic reaction)', pl: 'Anafilaksja (Zagrażająca życiu ciężka reakcja ogólnoustrojowa)' },
  { es: 'shock anafiláctico', en: 'Anaphylactic shock', pl: 'Wstrząs anafilaktyczny' },
  { es: 'angioedema', en: 'Angioedema (swelling of face, lips, tongue, or airway)', pl: 'Obrzęk naczynioruchowy (twarz, wargi, język, drogi oddechowe)' },
  { es: 'edema de glotis', en: 'Laryngeal edema (Glottic airway obstruction)', pl: 'Obrzęk głośni / krtani' },
  { es: 'urticaria', en: 'Urticaria (Hives)', pl: 'Pokrzywka' },
  { es: 'epipen', en: 'Epinephrine auto-injector (EpiPen)', pl: 'Autowstrzykiwacz z adrenaliną (EpiPen)' },
  { es: 'autoinyector de epinefrina', en: 'Epinephrine auto-injector', pl: 'Autowstrzykiwacz z adrenaliną' },
  { es: 'autoinyector de adrenalina', en: 'Adrenaline auto-injector', pl: 'Autowstrzykiwacz z adrenaliną' },

  // --- CONDICIONES MÉDICAS CRÓNICAS (CHRONIC CONDITIONS / CHOROBY PRZEWLEKŁE) ---
  { es: 'asma', en: 'Bronchial Asthma', pl: 'Astma oskrzelowa' },
  { es: 'asma bronquial', en: 'Bronchial Asthma', pl: 'Astma oskrzelowa' },
  { es: 'asma inducida por ejercicio', en: 'Exercise-induced asthma / bronchoconstriction', pl: 'Astma wysiłkowa / skurcz oskrzeli wywołany wysiłkiem' },
  { es: 'diabetes tipo 1', en: 'Type 1 Diabetes Mellitus (Insulin-dependent, T1D)', pl: 'Cukrzyca typu 1 (insulinozależna)' },
  { es: 'diabetes tipo 2', en: 'Type 2 Diabetes Mellitus (T2D)', pl: 'Cukrzyca typu 2' },
  { es: 'epilepsia', en: 'Epilepsy / Seizure disorder', pl: 'Padaczka / Zaburzenia drgawkowe' },
  { es: 'convulsiones', en: 'Seizures', pl: 'Napady drgawkowe' },
  { es: 'hipertensión', en: 'Arterial Hypertension', pl: 'Nadciśnienie tętnicze' },
  { es: 'hipotensión', en: 'Hypotension (Low blood pressure)', pl: 'Niedociśnienie tętnicze' },
  { es: 'cardiopatía congénita', en: 'Congenital heart defect / disease', pl: 'Wrodzona wada serca' },
  { es: 'arritmia', en: 'Cardiac arrhythmia', pl: 'Arytmia serca' },
  { es: 'soplo cardíaco', en: 'Heart murmur', pl: 'Szmer sercowy' },
  { es: 'celiaquía', en: 'Celiac disease (Gluten-sensitive enteropathy)', pl: 'Celiakia (Enteropatia z nadwrażliwości na gluten)' },
  { es: 'enfermedad celíaca', en: 'Celiac disease', pl: 'Celiakia' },
  { es: 'hipotiroidismo', en: 'Hypothyroidism', pl: 'Niedoczynność tarczycy' },
  { es: 'hipertiroidismo', en: 'Hyperthyroidism', pl: 'Nadczynność tarczycy' },
  { es: 'trastorno por déficit de atención', en: 'Attention Deficit Hyperactivity Disorder (ADHD)', pl: 'Zespół nadpobudliwości psychoruchowej z deficytem uwagi (ADHD)' },
  { es: 'tdah', en: 'ADHD (Attention Deficit Hyperactivity Disorder)', pl: 'ADHD (Zespół nadpobudliwości psychoruchowej)' },
  { es: 'autismo', en: 'Autism Spectrum Disorder (ASD)', pl: 'Spektrum autyzmu (ASD)' },
  { es: 'tea', en: 'Autism Spectrum Condition (ASC/ASD)', pl: 'Spektrum autyzmu (ASD)' },
  { es: 'asperger', en: 'Asperger Syndrome', pl: 'Zespół Aspergera' },
  { es: 'ansiedad', en: 'Anxiety disorder', pl: 'Zaburzenia lękowe' },
  { es: 'crisis de pánico', en: 'Panic attacks / Panic disorder', pl: 'Napady paniki / Zaburzenie lękowe z napadami paniki' },
  { es: 'depresión', en: 'Major Depressive Disorder', pl: 'Zaburzenia depresyjne' },
  { es: 'dermatitis atópica', en: 'Atopic dermatitis (Eczema)', pl: 'Atopowe zapalenie skóry (AZS)' },
  { es: 'rinitis alérgica', en: 'Allergic rhinitis', pl: 'Alergiczny nieżyt nosa' },
  { es: 'migraña', en: 'Migraine headache', pl: 'Migrena' },
  { es: 'sinusitis', en: 'Chronic sinusitis', pl: 'Przewlekłe zapalenie zatok' },
  { es: 'gastritis', en: 'Gastritis / Peptic condition', pl: 'Zapalenie błony śluzowej żołądka' },
  { es: 'reflujo gastroesofágico', en: 'Gastroesophageal Reflux Disease (GERD)', pl: 'Choroba refluksowa przełyku (GERD)' },
  { es: 'enfermedad de crohn', en: 'Crohn disease', pl: 'Choroba Leśniowskiego-Crohna' },
  { es: 'colitis ulcerosa', en: 'Ulcerative colitis', pl: 'Wrzodziejące zapalenie jelita grubego' },
  { es: 'anemia', en: 'Anemia', pl: 'Niedokrwistość (Anemia)' },
  { es: 'hemofilia', en: 'Hemophilia', pl: 'Hemofilia' },
  { es: 'escoliosis', en: 'Scoliosis', pl: 'Skolioza' },

  // --- MEDICACIÓN Y VÍAS DE ADMINISTRACIÓN (MEDICATIONS & ADMINISTRATION) ---
  { es: 'salbutamol', en: 'Salbutamol (Albuterol) inhaler', pl: 'Salbutamol inhalator' },
  { es: 'inhalador de rescate', en: 'Rescue inhaler (Bronchodilator)', pl: 'Inhalator ratunkowy (Rozszerzający oskrzela)' },
  { es: 'budesonida', en: 'Budesonide (Inhaled corticosteroid)', pl: 'Budezonid (Glikokortykosteroid wziewny)' },
  { es: 'fluticasona', en: 'Fluticasone inhaler', pl: 'Flutykazon inhalator' },
  { es: 'aerocámara', en: 'Spacer / Inhaler chamber', pl: 'Komora inhalacyjna (spejser)' },
  { es: 'insulina rápida', en: 'Rapid-acting insulin (Lispro, Aspart)', pl: 'Insulina szybko działająca (Lispro, Aspart)' },
  { es: 'insulina lenta', en: 'Long-acting basal insulin (Glargine, Degludec)', pl: 'Insulina długo działająca (Glargina, Degludec)' },
  { es: 'bomba de insulina', en: 'Continuous Insulin Pump', pl: 'Ciągła pompa insulinowa' },
  { es: 'sensor de glucosa', en: 'Continuous Glucose Monitor (CGM, FreeStyle Libre/Dexcom)', pl: 'System ciągłego monitorowania glikemii (CGM)' },
  { es: 'cadena de frío', en: 'Requires refrigeration (Cold chain storage 2-8°C)', pl: 'Wymaga przechowywania w lodówce (Łańcuch chłodniczy 2-8°C)' },
  { es: 'refrigeración', en: 'Requires refrigeration (2-8°C)', pl: 'Wymaga chłodzenia (2-8°C)' },
  { es: 'metformina', en: 'Metformin', pl: 'Metformina' },
  { es: 'levotiroxina', en: 'Levothyroxine', pl: 'Lewotyroksyna' },
  { es: 'loratadina', en: 'Loratadine', pl: 'Loratadyna' },
  { es: 'cetirizina', en: 'Cetirizine', pl: 'Cetyryzyna' },
  { es: 'desloratadina', en: 'Desloratadine', pl: 'Desloratadyna' },
  { es: 'levocetirizina', en: 'Levocetirizine', pl: 'Lewocetyryzyna' },
  { es: 'fexofenadina', en: 'Fexofenadine', pl: 'Feksofenadyna' },
  { es: 'prednisona', en: 'Prednisone (Oral corticosteroid)', pl: 'Prednizon (Glikokortykosteroid doustny)' },
  { es: 'metilprednisolona', en: 'Methylprednisolone', pl: 'Metyloprednizolon' },
  { es: 'dexametasona', en: 'Dexamethasone', pl: 'Deksametazon' },
  { es: 'metilfenidato', en: 'Methylphenidate (Ritalin/Concerta)', pl: 'Metylofenidat' },
  { es: 'lisdexanfetamina', en: 'Lisdexamfetamine (Vyvanse)', pl: 'Lisdeksamfetamina' },
  { es: 'sertralina', en: 'Sertraline', pl: 'Sertralina' },
  { es: 'escitalopram', en: 'Escitalopram', pl: 'Escytalopram' },
  { es: 'fluoxetina', en: 'Fluoxetine', pl: 'Fluoksetyna' },
  { es: 'clonazepam', en: 'Clonazepam', pl: 'Klonazepam' },
  { es: 'levetiracetam', en: 'Levetiracetam (Keppra)', pl: 'Lewetyracetam' },
  { es: 'ácido valproico', en: 'Valproic acid', pl: 'Kwas walproinowy' },
  { es: 'valproato', en: 'Sodium valproate', pl: 'Walproinian sodu' },
  { es: 'lamotrigina', en: 'Lamotrigine', pl: 'Lamotrygina' },
  { es: 'carbamazepina', en: 'Carbamazepine', pl: 'Karbamazepina' },
  { es: 'omeprazol', en: 'Omeprazole', pl: 'Omeprazol' },
  { es: 'esomeprazol', en: 'Esomeprazole', pl: 'Ezomeprazol' },

  // --- VACUNACIÓN (VACCINATION / SZCZEPIENIA) ---
  { es: 'tétanos', en: 'Tetanus toxoid vaccine (Td/Tdap)', pl: 'Szczepionka przeciwtężcowa (Td/Tdap)' },
  { es: 'antitetánica', en: 'Tetanus toxoid booster', pl: 'Szczepienie przypominające przeciw tężcowi' },
  { es: 'difteria', en: 'Diphtheria vaccine', pl: 'Szczepionka przeciw błonicy' },
  { es: 'tos ferina', en: 'Pertussis (Whooping cough) vaccine', pl: 'Szczepionka przeciw krztuścowi' },
  { es: 'hepatitis a', en: 'Hepatitis A vaccine', pl: 'Szczepionka przeciw WZW typu A' },
  { es: 'hepatitis b', en: 'Hepatitis B vaccine', pl: 'Szczepionka przeciw WZW typu B' },
  { es: 'tres vírica', en: 'MMR vaccine (Measles, Mumps, Rubella)', pl: 'Szczepionka MMR (Odra, świnka, różyczka)' },
  { es: 'sarampión', en: 'Measles vaccine', pl: 'Szczepionka przeciw odrze' },
  { es: 'fiebre amarilla', en: 'Yellow fever vaccine', pl: 'Szczepionka przeciw żółtej febrze' },
  { es: 'covid-19', en: 'COVID-19 vaccination', pl: 'Szczepienie przeciw COVID-19' },
  { es: 'meningococo', en: 'Meningococcal conjugate vaccine', pl: 'Szczepionka przeciw meningokokom' },
  { es: 'neumococo', en: 'Pneumococcal conjugate vaccine', pl: 'Szczepionka przeciw pneumokokom' },
  { es: 'influenza', en: 'Seasonal influenza (Flu) vaccine', pl: 'Szczepionka przeciw grypie sezonowej' },

  // --- DISPOSITIVOS E IMPLANTES (DEVICES & IMPLANTS) ---
  { es: 'lentes ópticos', en: 'Prescription eyeglasses', pl: 'Okulary korekcyjne' },
  { es: 'lentes de contacto', en: 'Contact lenses', pl: 'Soczewki kontaktowe' },
  { es: 'aparato auditivo', en: 'Hearing aid device', pl: 'Aparat słuchowy' },
  { es: 'audífono médico', en: 'Medical hearing aid', pl: 'Medyczny aparat słuchowy' },
  { es: 'implante coclear', en: 'Cochlear implant', pl: 'Implant ślimakowy' },
  { es: 'frenillos', en: 'Orthodontic braces', pl: 'Aparat ortodontyczny' },
  { es: 'brackets', en: 'Dental brackets / Braces', pl: 'Zamki ortodontyczne / Aparat' },
  { es: 'prótesis', en: 'Prosthetic limb / device', pl: 'Proteza kończyny / urządzenie protetyczne' },
  { es: 'férula', en: 'Orthopedic splint / brace', pl: 'Szyna ortopedyczna' },
  { es: 'plantillas ortopédicas', en: 'Orthopedic shoe insoles', pl: 'Wkładki ortopedyczne' },

  // --- CIRUGÍAS Y TRAUMATISMOS (SURGERIES & INJURIES) ---
  { es: 'apendicectomía', en: 'Appendectomy (surgical removal of appendix)', pl: 'Apendektomia (wycięcie wyrostka robaczkowego)' },
  { es: 'amigdalectomía', en: 'Tonsillectomy', pl: 'Tonsillektomia (usunięcie migdałków)' },
  { es: 'adenoidectomía', en: 'Adenoidectomy', pl: 'Adenotomia (usunięcie migdałka gardłowego)' },
  { es: 'fractura', en: 'Bone fracture', pl: 'Złamanie kości' },
  { es: 'fractura de brazo', en: 'Arm fracture', pl: 'Złamanie ręki' },
  { es: 'fractura de pierna', en: 'Leg fracture', pl: 'Złamanie nogi' },
  { es: 'fractura de clavícula', en: 'Clavicle fracture', pl: 'Złamanie obojczyka' },
  { es: 'esguince', en: 'Sprain / Ligament injury', pl: 'Skręcenie stawu / uraz więzadła' },
  { es: 'esguince de tobillo', en: 'Ankle sprain', pl: 'Skręcenie stawu skokowego' },
  { es: 'luxación', en: 'Joint dislocation', pl: 'Zwichnięcie stawu' },
  { es: 'traumatismo encéfalo craneano', en: 'Traumatic brain injury (Concussion/TBI)', pl: 'Uraz czaszkowo-mózgowy (Wstrząśnienie mózgu)' },
  { es: 'tec', en: 'Traumatic Brain Injury (Concussion/TBI)', pl: 'Uraz czaszkowo-mózgowy (TBI)' },

  // --- DIETAS E INTOLERANCIAS ---
  { es: 'vegetariano', en: 'Vegetarian diet', pl: 'Dieta wegetariańska' },
  { es: 'vegetariana', en: 'Vegetarian diet', pl: 'Dieta wegetariańska' },
  { es: 'vegano', en: 'Strict Vegan diet', pl: 'Ścisła dieta wegańska' },
  { es: 'vegana', en: 'Strict Vegan diet', pl: 'Ścisła dieta wegańska' },
  { es: 'sin gluten', en: 'Strict Gluten-free diet (Celiac safe)', pl: 'Ścisła dieta bezglutenowa (bezpieczna dla celiakii)' },
  { es: 'celíaco', en: 'Celiac diet (Gluten-free)', pl: 'Dieta bezglutenowa (dla chorych na celiakię)' },
  { es: 'celíaca', en: 'Celiac diet (Gluten-free)', pl: 'Dieta bezglutenowa (dla chorych na celiakię)' },
  { es: 'sin lactosa', en: 'Lactose-free diet', pl: 'Dieta bezlaktozowa' },
  { es: 'kosher', en: 'Certified Kosher diet', pl: 'Dieta koszerna' },
  { es: 'halal', en: 'Certified Halal diet', pl: 'Dieta halal' },

  // --- LIMITACIONES FÍSICAS Y ACUÁTICAS ---
  { es: 'sabe nadar', en: 'Can swim (Proficient swimmer)', pl: 'Umiejętność pływania (Pływak)' },
  { es: 'no sabe nadar', en: 'Cannot swim (Non-swimmer, requires lifejacket)', pl: 'Nie umie pływać (Wymaga kamizelki ratunkowej)' },
  { es: 'natación básica', en: 'Basic swimming ability only (Needs supervision)', pl: 'Podstawowa umiejętność pływania (Wymaga nadzoru)' },
  { es: 'caminatas largas', en: 'Difficulty with long strenuous hikes', pl: 'Trudności z długimi, forsownymi wędrówkami' },
  { es: 'mareo en transporte', en: 'Motion sickness (Kinetosis)', pl: 'Choroba lokomocyjna (Kinetoza)' },
  { es: 'sonambulismo', en: 'Sleepwalking (Somnambulism)', pl: 'Somnambulizm (Sennowłóctwo)' },
  { es: 'enuresis', en: 'Enuresis (Bedwetting)', pl: 'Moczenie nocne' },
  { es: 'vértigo', en: 'Vertigo / Acrophobia (Fear of heights)', pl: 'Zawroty głowy / Lęk wysokości' },
  { es: 'claustrofobia', en: 'Claustrophobia', pl: 'Klaustrofobia' },

  // --- FRASES FRECUENTES ---
  { es: 'ninguna', en: 'None reported', pl: 'Brak zgłoszonych' },
  { es: 'ninguno', en: 'None reported', pl: 'Brak zgłoszonych' },
  { es: 'no refiere', en: 'No known allergies or conditions', pl: 'Brak znanych alergii ani schorzeń' },
  { es: 'no tiene', en: 'None', pl: 'Brak' },
  { es: 'sin antecedentes', en: 'No significant medical history', pl: 'Brak istotnego wywiadu chorobowego' },
  { es: 'al día', en: 'Up to date', pl: 'Aktualne' },
  { es: 'autónomo', en: 'Autonomous / Self-administers medication', pl: 'Samodzielny / Samodzielnie przyjmuje leki' },
  { es: 'requiere supervisión', en: 'Requires adult supervision for medication', pl: 'Wymaga nadzoru osoby dorosłej przy przyjmowaniu leków' },
];

// Pre-ordenar una sola vez por longitud descendente para evitar colisiones de subcadenas
const SORTED_CLINICAL_DICTIONARY = [...CLINICAL_DICTIONARY].sort(
  (a, b) => b.es.length - a.es.length
);

const CLINICAL_DICTIONARY_MAP = new Map<string, MedicalDictionaryEntry>(
  SORTED_CLINICAL_DICTIONARY.map((item) => [item.es.toLowerCase(), item])
);

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const CLINICAL_DICTIONARY_REGEX = new RegExp(
  `(?<![\\p{L}\\p{N}])(${SORTED_CLINICAL_DICTIONARY.map((item) => escapeRegExp(item.es)).join('|')})(?![\\p{L}\\p{N}])`,
  'giu'
);

/**
 * Traduce un segmento individual reemplazando términos clínicos con límites Unicode
 * mediante placeholders para evitar doble reemplazo, y luego aplica heurísticas de dosis/frecuencias.
 */
function translateSingleSegment(segment: string): { en: string; pl: string } {
  const matches: MedicalDictionaryEntry[] = [];
  const tokenized = segment.replace(CLINICAL_DICTIONARY_REGEX, (matched) => {
    const entry = CLINICAL_DICTIONARY_MAP.get(matched.toLowerCase());
    if (!entry) return matched;
    const tokenIndex = matches.length;
    matches.push(entry);
    return `\uE000${tokenIndex}\uE001`;
  });

  const heuristic = translateSegmentHeuristic(tokenized);

  const restorePlaceholders = (text: string, lang: 'en' | 'pl'): string =>
    cleanTranslatedText(
      text.replace(/\uE000(\d+)\uE001/g, (_, idx) => matches[Number(idx)]?.[lang] ?? '')
    );

  return {
    en: restorePlaceholders(heuristic.en, 'en'),
    pl: restorePlaceholders(heuristic.pl, 'pl'),
  };
}

/**
 * Traduce un texto médico del español a inglés y polaco.
 * Combina coincidencia exacta de diccionario clínico, sustitución de sintagmas médicos
 * y estructuración estandarizada.
 */
export function translateMedicalText(text: string | null | undefined): { es: string; en: string; pl: string } {
  if (!text || !text.trim()) {
    return {
      es: 'No registrado / Sin observaciones',
      en: 'Not reported / No observations',
      pl: 'Nie zarejestrowano / Brak uwag',
    };
  }

  const raw = text.trim();
  const lower = raw.toLowerCase();

  // 1. Caso de "ninguno / no refiere"
  if (
    lower === 'no' ||
    lower === 'ninguna' ||
    lower === 'ninguno' ||
    lower === 'no refiere' ||
    lower === 'sin antecedentes' ||
    lower === 'na' ||
    lower === 'n/a' ||
    lower === 'ninguna conocida' ||
    lower === 'no tiene'
  ) {
    return {
      es: 'Ninguna conocida / No refiere',
      en: 'None known / No significant history reported',
      pl: 'Brak znanych / Brak istotnego wywiadu chorobowego',
    };
  }

  // 2. Coincidencia directa completa en diccionario
  const directMatch = CLINICAL_DICTIONARY_MAP.get(lower);
  if (directMatch) {
    return {
      es: raw,
      en: directMatch.en,
      pl: directMatch.pl,
    };
  }

  // 3. Procesamiento unificado por segmentos (lista o texto libre)
  const segments = raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length > 1) {
    const translatedEN: string[] = [];
    const translatedPL: string[] = [];

    for (const segment of segments) {
      const segDirect = CLINICAL_DICTIONARY_MAP.get(segment.toLowerCase());
      if (segDirect) {
        translatedEN.push(segDirect.en);
        translatedPL.push(segDirect.pl);
      } else {
        const translated = translateSingleSegment(segment);
        translatedEN.push(translated.en);
        translatedPL.push(translated.pl);
      }
    }

    return {
      es: raw,
      en: translatedEN.join('; '),
      pl: translatedPL.join('; '),
    };
  }

  const single = translateSingleSegment(raw);
  return {
    es: raw,
    en: single.en,
    pl: single.pl,
  };
}

function cleanTranslatedText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Traduce términos comunes y números/dosis de recetas clínicas
 */
function translateSegmentHeuristic(segment: string): { en: string; pl: string } {
  let en = segment;
  let pl = segment;

  const patterns: [RegExp, string, string][] = [
    // Frecuencias y dosis
    [/(\d+)\s*(mg|miligramos)/gi, '$1 mg', '$1 mg'],
    [/(\d+)\s*(mcg|microgramos)/gi, '$1 mcg', '$1 mcg'],
    [/(\d+)\s*(ml|mililitros)/gi, '$1 mL', '$1 ml'],
    [/(\d+)\s*(gotas)/gi, '$1 drops', '$1 kropli'],
    [/(\d+)\s*(comprimidos|comprimido|pastillas|pastilla|tabletas|tableta)/gi, '$1 tablet(s)', '$1 tabl.'],
    [/(\d+)\s*(puffs|puff|disparos)/gi, '$1 puff(s)', '$1 dawek (inhalacji)'],
    [/cada\s*(\d+)\s*horas?/gi, 'every $1 hours', 'co $1 godz.'],
    [/cada\s*(\d+)\s*d[ií]as?/gi, 'every $1 days', 'co $1 dni'],
    [/una vez al d[ií]a/gi, 'once daily (q.d.)', 'raz dziennie'],
    [/dos veces al d[ií]a/gi, 'twice daily (b.i.d.)', 'dwa razy dziennie'],
    [/tres veces al d[ií]a/gi, 'three times daily (t.i.d.)', 'trzy razy dziennie'],
    [/en la ma[ñn]ana/gi, 'in the morning', 'rano'],
    [/en la noche/gi, 'at bedtime / night', 'wieczorem / przed snem'],
    [/con las comidas/gi, 'with meals', 'z posiłkami'],
    [/en ayunas/gi, 'on an empty stomach', 'na czczo'],
    [/s[oó]lo si es necesario|sos/gi, 'as needed (PRN)', 'w razie potrzeby (doraźnie)'],
    [/en caso de crisis/gi, 'in case of acute emergency / crisis', 'w razie ataku / kryzysu'],
    [/v[ií]a oral/gi, 'oral route', 'doustnie'],
    [/v[ií]a inhalatoria/gi, 'inhalation route', 'wziewnie'],
    [/v[ií]a subcut[aá]nea/gi, 'subcutaneous injection', 'podskórnie'],

    // Conectores clínicos
    [/al[eé]rgico a/gi, 'Allergic to', 'Uczulony na'],
    [/alergia a/gi, 'Allergy to', 'Alergia na'],
    [/diagn[oó]stico de/gi, 'Diagnosed with', 'Rozpoznanie:'],
    [/tratamiento con/gi, 'Treated with', 'Leczenie:'],
    [/antecedentes de/gi, 'History of', 'W wywiadzie:'],
    [/operado de/gi, 'Surgically operated for', 'Stan po operacji:'],
    [/usa /gi, 'Uses ', 'Używa '],
    [/requiere /gi, 'Requires ', 'Wymaga '],
    [/sin /gi, 'Without ', 'Bez '],
    [/con /gi, 'With ', 'Z '],
  ];

  for (const [regex, repEN, repPL] of patterns) {
    en = en.replace(regex, repEN);
    pl = pl.replace(regex, repPL);
  }

  return { en: cleanTranslatedText(en), pl: cleanTranslatedText(pl) };
}

/**
 * Traduce el formulario médico completo estructurado
 */
export function translateCompleteMedicalRecord(data: {
  bloodType?: string | null;
  allergiesES?: string | null;
  hasSevereAllergies?: boolean;
  carriesEpiPen?: boolean;
  chronicConditionsES?: string | null;
  currentMedicationsES?: string | null;
  requiresColdChainMedication?: boolean;
  dietaryRestrictionsES?: string | null;
  vaccinationRecordsES?: string | null;
  tetanusLastDoseYear?: string | null;
  pastSurgeriesInjuriesES?: string | null;
  devicesImplantsES?: string | null;
  physicalLimitationsES?: string | null;
}) {
  const allergiesTrans = translateMedicalText(data.allergiesES);
  const conditionsTrans = translateMedicalText(data.chronicConditionsES);
  const medicationsTrans = translateMedicalText(data.currentMedicationsES);
  const dietaryTrans = translateMedicalText(data.dietaryRestrictionsES);
  const vaccinationTrans = translateMedicalText(data.vaccinationRecordsES);
  const surgeriesTrans = translateMedicalText(data.pastSurgeriesInjuriesES);
  const devicesTrans = translateMedicalText(data.devicesImplantsES);
  const limitationsTrans = translateMedicalText(data.physicalLimitationsES);

  // Agregar flags críticos en inglés y polaco si corresponde
  let allergiesEN = allergiesTrans.en;
  let allergiesPL = allergiesTrans.pl;
  if (data.hasSevereAllergies) {
    allergiesEN = `[CRITICAL ANAPHYLAXIS RISK] ${allergiesEN}`;
    allergiesPL = `[KRYTYCZNE RYZYKO ANAFILAKSJI] ${allergiesPL}`;
  }
  if (data.carriesEpiPen) {
    allergiesEN += ' | PATIENT CARRIES EPINEPHRINE AUTO-INJECTOR (EpiPen)';
    allergiesPL += ' | PACJENT POSIADA AUTOWSTRZYKIWACZ Z ADRENALINĄ (EpiPen)';
  }

  let medicationsEN = medicationsTrans.en;
  let medicationsPL = medicationsTrans.pl;
  if (data.requiresColdChainMedication) {
    medicationsEN = `[COLD CHAIN 2-8°C REQUIRED] ${medicationsEN}`;
    medicationsPL = `[WYMAGANY ŁAŃCUCH CHŁODNICZY 2-8°C] ${medicationsPL}`;
  }

  let vaccinationEN = vaccinationTrans.en;
  let vaccinationPL = vaccinationTrans.pl;
  if (data.tetanusLastDoseYear) {
    vaccinationEN = `Tetanus toxoid booster year: ${data.tetanusLastDoseYear}. ${vaccinationEN}`;
    vaccinationPL = `Rok ostatniej dawki przeciwtężcowej: ${data.tetanusLastDoseYear}. ${vaccinationPL}`;
  }

  return {
    allergiesEN,
    allergiesPL,
    chronicConditionsEN: conditionsTrans.en,
    chronicConditionsPL: conditionsTrans.pl,
    currentMedicationsEN: medicationsEN,
    currentMedicationsPL: medicationsPL,
    dietaryRestrictionsEN: dietaryTrans.en,
    dietaryRestrictionsPL: dietaryTrans.pl,
    vaccinationRecordsEN: vaccinationEN,
    vaccinationRecordsPL: vaccinationPL,
    pastSurgeriesInjuriesEN: surgeriesTrans.en,
    pastSurgeriesInjuriesPL: surgeriesTrans.pl,
    devicesImplantsEN: devicesTrans.en,
    devicesImplantsPL: devicesTrans.pl,
    physicalLimitationsEN: limitationsTrans.en,
    physicalLimitationsPL: limitationsTrans.pl,
  };
}
