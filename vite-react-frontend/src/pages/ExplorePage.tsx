// src/pages/ExplorePage.tsx
import React, { useMemo, useState } from 'react';

type OverallTaxRule = 'CAPITAL' | 'NOTIONAL';
type TaxToggle = 'EXEMPTIONCARD' | 'STOCKEXEMPTION';
type PhaseType = 'DEPOSIT' | 'PASSIVE' | 'WITHDRAW';

type PhaseInput = {
  type: PhaseType;
  durationInMonths: number;
  // DEPOSIT
  initialDeposit?: number;
  monthlyDeposit?: number;
  yearlyIncreasePercent?: number;
  // WITHDRAW
  withdrawAmount?: number;
  lowerVariationPercent?: number;
  upperVariationPercent?: number;
  // Shared
  taxRules?: TaxToggle[];
};

type SimulationInputs = {
  startDate: string; // ISO yyyy-mm-dd
  overallTaxRule: OverallTaxRule;
  taxPercentage: number;
  phases: PhaseInput[];
};

type OutputPoint = {
  year: number;
  phaseName: PhaseType | 'Deposit' | 'Passive' | 'Withdraw';
  averageCapital: number;
  medianCapital: number;
  minCapital: number;
  maxCapital: number;
  stdDevCapital: number;
  quantile5: number;
  quantile25: number;
  quantile75: number;
  quantile95: number;
  cvar: number;
  var: number;
  cumulativeGrowthRate: number;
  negativeCapitalPercentage: number;
};

type ExploreRow = {
  id: string;
  title?: string;
  owner?: string;
  inputs: SimulationInputs;
  outputs: OutputPoint[];
  notes?: string;
};

const SAMPLE_OUTPUTS: OutputPoint[] = /* your provided example */ [
  {"averageCapital":137081.10100029828,"cumulativeGrowthRate":0.0,"cvar":111369.09808514512,"maxCapital":205121.0923857385,"medianCapital":136163.67640589332,"minCapital":95122.39972579043,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":127505.56393263002,"quantile5":116032.1336231273,"quantile75":145887.67544225173,"quantile95":161394.7697969529,"stdDevCapital":13872.250368678953,"var":116032.1336231273,"year":2026},{"averageCapital":280883.0636469657,"cumulativeGrowthRate":104.90283605641197,"cvar":208185.02913574874,"maxCapital":466032.84594897093,"medianCapital":277870.63715061464,"minCapital":155784.63345245598,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":251990.49696535384,"quantile5":220537.98856326472,"quantile75":305021.8064634395,"quantile95":353730.3151798534,"stdDevCapital":40791.87013945777,"var":220537.98856326472,"year":2027},{"averageCapital":443936.6496904314,"cumulativeGrowthRate":58.050344483711314,"cvar":304277.86738759774,"maxCapital":879123.8874229796,"medianCapital":435500.3062197331,"minCapital":226349.1722636644,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":385770.94161432725,"quantile5":325520.3430580979,"quantile75":492835.0050464895,"quantile95":590733.6502975031,"stdDevCapital":81677.92268437619,"var":325520.3430580979,"year":2028},{"averageCapital":627307.5095841121,"cumulativeGrowthRate":41.30563674378989,"cvar":403836.81234445644,"maxCapital":1431670.9299770785,"medianCapital":609514.4038854595,"minCapital":296194.5775233691,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":530016.87790623,"quantile5":437320.4307676879,"quantile75":705306.8176018291,"quantile95":876164.0209201048,"stdDevCapital":136692.25767435296,"var":437320.4307676879,"year":2029},{"averageCapital":836113.8812485773,"cumulativeGrowthRate":33.286126576565,"cvar":504918.4730350758,"maxCapital":2485438.4018731653,"medianCapital":808477.6672910616,"minCapital":365274.6772105296,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":688321.6607270545,"quantile5":556390.496325776,"quantile75":947857.2616144038,"quantile95":1224494.1650949216,"stdDevCapital":208549.00659614004,"var":556390.496325776,"year":2030},{"averageCapital":1067382.3026817732,"cumulativeGrowthRate":27.659918896196345,"cvar":611226.7936383738,"maxCapital":3544491.379226137,"medianCapital":1025091.8072360883,"minCapital":378826.31106033106,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":863667.5906454785,"quantile5":675434.7795924613,"quantile75":1223113.8261724568,"quantile95":1603014.7390114882,"stdDevCapital":292769.6963823771,"var":675434.7795924613,"year":2031},{"averageCapital":1330474.5018891653,"cumulativeGrowthRate":24.648356877041987,"cvar":722645.1914665865,"maxCapital":4747785.288837384,"medianCapital":1270359.2141352268,"minCapital":405802.65026648773,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":1049083.6837426939,"quantile5":804135.4803739047,"quantile75":1539608.7297150863,"quantile95":2057595.3163421105,"stdDevCapital":397525.03068311187,"var":804135.4803739047,"year":2032},{"averageCapital":1624739.6327120496,"cumulativeGrowthRate":22.11730705136039,"cvar":842247.0910720656,"maxCapital":5112817.675347515,"medianCapital":1542519.369836721,"minCapital":483755.1716914791,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":1253134.165091087,"quantile5":943025.0889724317,"quantile75":1892402.399586737,"quantile95":2608370.140632987,"stdDevCapital":522849.37636034173,"var":943025.0889724317,"year":2033},{"averageCapital":1960495.9946333196,"cumulativeGrowthRate":20.665241073784756,"cvar":972542.8230717006,"maxCapital":7088600.410307097,"medianCapital":1840992.43247275,"minCapital":512457.5045092318,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":1480147.7979105944,"quantile5":1097596.0489532645,"quantile75":2304016.139845786,"quantile95":3212628.5837634355,"stdDevCapital":677638.6944096615,"var":1097596.0489532645,"year":2034},{"averageCapital":2325658.736501187,"cumulativeGrowthRate":18.62603865896526,"cvar":1102381.9832283496,"maxCapital":9291869.575531358,"medianCapital":2169570.3915812178,"minCapital":668963.1639908674,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":1726894.0864474531,"quantile5":1251866.7591606649,"quantile75":2755840.254751859,"quantile95":3899948.3140735375,"stdDevCapital":852481.245194885,"var":1251866.7591606649,"year":2035},{"averageCapital":2740615.586382297,"cumulativeGrowthRate":17.842551160596653,"cvar":1248590.5731377257,"maxCapital":1.4545531728056516E7,"medianCapital":2529347.8098503184,"minCapital":828568.2149041361,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":1983395.4795486848,"quantile5":1420072.7623540165,"quantile75":3261352.3850982888,"quantile95":4761069.289033168,"stdDevCapital":1082366.8517272642,"var":1420072.7623540165,"year":2036},{"averageCapital":3203842.188888711,"cumulativeGrowthRate":16.902283005618045,"cvar":1407051.3882526536,"maxCapital":1.9432818767766714E7,"medianCapital":2928913.6365741347,"minCapital":813820.2299728203,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":2278579.9914681725,"quantile5":1612984.5688091246,"quantile75":3815973.9860103633,"quantile95":5693845.7065488575,"stdDevCapital":1321199.8218153089,"var":1612984.5688091246,"year":2037},{"averageCapital":3720197.1417255327,"cumulativeGrowthRate":16.11674116245798,"cvar":1578535.7101460434,"maxCapital":1.903952654541321E7,"medianCapital":3376624.379620346,"minCapital":887815.4594937298,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":2594915.1299530016,"quantile5":1807896.9684099434,"quantile75":4477868.022931062,"quantile95":6751275.521388919,"stdDevCapital":1620224.9480938578,"var":1807896.9684099434,"year":2038},{"averageCapital":4319525.155279179,"cumulativeGrowthRate":16.110114349361094,"cvar":1740506.3405640835,"maxCapital":1.9931308734228536E7,"medianCapital":3874219.1191440057,"minCapital":987646.4414472135,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":2938499.464428083,"quantile5":2009039.5821178101,"quantile75":5222480.004143888,"quantile95":8140786.820983657,"stdDevCapital":1993780.5160338832,"var":2009039.5821178101,"year":2039},{"averageCapital":4978763.13627043,"cumulativeGrowthRate":15.261815993490679,"cvar":1925398.5062894654,"maxCapital":2.6003326749310523E7,"medianCapital":4427955.929524077,"minCapital":964100.4877078242,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":3308034.147449593,"quantile5":2239897.6414198736,"quantile75":6020090.643998481,"quantile95":9552482.581457287,"stdDevCapital":2424886.2559751566,"var":2239897.6414198736,"year":2040},{"averageCapital":5718283.6619213745,"cumulativeGrowthRate":14.853498859255154,"cvar":2120758.827223757,"maxCapital":3.1454849683272E7,"medianCapital":5036160.797682493,"minCapital":962592.456268075,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":3719133.8084971043,"quantile5":2478124.8555587237,"quantile75":6903345.076052533,"quantile95":1.1361807923593841E7,"stdDevCapital":2963331.13105688,"var":2478124.8555587237,"year":2041},{"averageCapital":6539722.374566383,"cumulativeGrowthRate":14.365127041791425,"cvar":2292956.9406585824,"maxCapital":4.421371812294212E7,"medianCapital":5686839.441575404,"minCapital":1208884.7859406478,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":4164922.663950347,"quantile5":2690414.8272202625,"quantile75":7958873.37502516,"quantile95":1.3224398903240671E7,"stdDevCapital":3525822.246001775,"var":2690414.8272202625,"year":2042},{"averageCapital":7456458.038196973,"cumulativeGrowthRate":14.017959954934245,"cvar":2534265.2973364154,"maxCapital":5.366962902831876E7,"medianCapital":6436467.589054155,"minCapital":1156575.4829218101,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":4668186.152734,"quantile5":3003681.4262635834,"quantile75":9028180.177186426,"quantile95":1.533771279739728E7,"stdDevCapital":4215159.801020377,"var":3003681.4262635834,"year":2043},{"averageCapital":8464141.231175106,"cumulativeGrowthRate":13.514234074893272,"cvar":2756597.6203153357,"maxCapital":6.216489377839473E7,"medianCapital":7232323.890063081,"minCapital":1674531.6261470804,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":5163348.532821624,"quantile5":3294589.0792475957,"quantile75":1.0264217624846566E7,"quantile95":1.78140891981414E7,"stdDevCapital":5009803.6895534815,"var":3294589.0792475957,"year":2044},{"averageCapital":9594514.139146034,"cumulativeGrowthRate":13.35484459790841,"cvar":3019878.854063894,"maxCapital":7.55737096452268E7,"medianCapital":8121330.461112169,"minCapital":1570292.0077273895,"negativeCapitalPercentage":0.0,"phaseName":"Deposit","quantile25":5753253.801968794,"quantile5":3586722.840123109,"quantile75":1.1616279020397613E7,"quantile95":2.0571231809588984E7,"stdDevCapital":5883968.923248804,"var":3586722.840123109,"year":2045},{"averageCapital":1.0654194434817823E7,"cumulativeGrowthRate":0.0,"cvar":3101398.2855561646,"maxCapital":9.106019832624519E7,"medianCapital":8949050.363255572,"minCapital":1460859.4761224198,"negativeCapitalPercentage":0.0,"phaseName":"Passive","quantile25":6224747.868491508,"quantile5":3753069.324244861,"quantile75":1.300794863902553E7,"quantile95":2.3322560590703223E7,"stdDevCapital":6830539.524509705,"var":3753069.324244861,"year":2046},{"averageCapital":1.1854497591669984E7,"cumulativeGrowthRate":11.266015128554251,"cvar":3203361.948290075,"maxCapital":8.640589822878303E7,"medianCapital":9815885.033737192,"minCapital":1323171.0107879324,"negativeCapitalPercentage":0.0,"phaseName":"Passive","quantile25":6679947.968313439,"quantile5":3921659.3307535825,"quantile75":1.4515218869396383E7,"quantile95":2.6947392701249227E7,"stdDevCapital":7946474.996381957,"var":3921659.3307535825,"year":2047},{"averageCapital":1.3186555014783131E7,"cumulativeGrowthRate":11.2367260848673,"cvar":3314418.6524277516,"maxCapital":1.142162696308152E8,"medianCapital":1.0700355214378422E7,"minCapital":1310167.838059572,"negativeCapitalPercentage":0.0,"phaseName":"Passive","quantile25":7200233.69294587,"quantile5":4114771.2234471086,"quantile75":1.629608062958942E7,"quantile95":3.0366116187877163E7,"stdDevCapital":9197714.470740277,"var":4114771.2234471086,"year":2048},{"averageCapital":1.4710528792416772E7,"cumulativeGrowthRate":11.557027411064901,"cvar":3430735.309474752,"maxCapital":1.80642645823269E8,"medianCapital":1.1842685497128036E7,"minCapital":1132599.03456546,"negativeCapitalPercentage":0.0,"phaseName":"Passive","quantile25":7772816.727722521,"quantile5":4276174.846693504,"quantile75":1.827316923629956E7,"quantile95":3.467268570454821E7,"stdDevCapital":1.0858700612400606E7,"var":4276174.846693504,"year":2049},{"averageCapital":1.6331736713659875E7,"cumulativeGrowthRate":11.02073177735685,"cvar":3594862.232445694,"maxCapital":1.912733279480419E8,"medianCapital":1.2891575100278517E7,"minCapital":938301.4823266895,"negativeCapitalPercentage":0.0,"phaseName":"Passive","quantile25":8451165.073558027,"quantile5":4560122.939777729,"quantile75":2.0334843135119528E7,"quantile95":3.941855222860645E7,"stdDevCapital":1.2482190404898036E7,"var":4560122.939777729,"year":2050},{"averageCapital":1.7885049994919725E7,"cumulativeGrowthRate":0.0,"cvar":3505013.293104372,"maxCapital":2.196877542442386E8,"medianCapital":1.3928264433290899E7,"minCapital":719244.5899051856,"negativeCapitalPercentage":0.0,"phaseName":"Withdraw","quantile25":8776343.659339007,"quantile5":4504633.767710184,"quantile75":2.222975041453298E7,"quantile95":4.387687479956211E7,"stdDevCapital":1.4430176415081799E7,"var":4504633.767710184,"year":2051},{"averageCapital":1.9589063815348394E7,"cumulativeGrowthRate":9.527587683079997,"cvar":3446738.843230263,"maxCapital":2.2658808681842703E8,"medianCapital":1.4833706246506568E7,"minCapital":464578.51898450725,"negativeCapitalPercentage":0.0,"phaseName":"Withdraw","quantile25":9261678.451120563,"quantile5":4537447.954633978,"quantile75":2.4431854974982172E7,"quantile95":4.926050918643345E7,"stdDevCapital":1.6606455394432776E7,"var":4537447.954633978,"year":2052},{"averageCapital":2.1584450001365084E7,"cumulativeGrowthRate":10.186225359341927,"cvar":3406964.7548370496,"maxCapital":2.4944652211361793E8,"medianCapital":1.588675468274073E7,"minCapital":269319.203201957,"negativeCapitalPercentage":0.0,"phaseName":"Withdraw","quantile25":9763763.06352825,"quantile5":4568806.990320351,"quantile75":2.6858177394849997E7,"quantile95":5.69326440543349E7,"stdDevCapital":1.9116735822255973E7,"var":4568806.990320351,"year":2053},{"averageCapital":2.3691494602384172E7,"cumulativeGrowthRate":9.761863753238242,"cvar":3403368.718068812,"maxCapital":3.0171927520563185E8,"medianCapital":1.717665214592017E7,"minCapital":119914.17258917882,"negativeCapitalPercentage":0.0,"phaseName":"Withdraw","quantile25":1.0252042472683659E7,"quantile5":4648719.152296128,"quantile75":2.9572545211845648E7,"quantile95":6.420123871116218E7,"stdDevCapital":2.181168955962517E7,"var":4648719.152296128,"year":2054},{"averageCapital":2.5968617653824106E7,"cumulativeGrowthRate":9.611563515333387,"cvar":3356690.317499874,"maxCapital":3.825146933271063E8,"medianCapital":1.866358558208438E7,"minCapital":0.0,"negativeCapitalPercentage":0.01,"phaseName":"Withdraw","quantile25":1.0763801059459839E7,"quantile5":4701642.24250662,"quantile75":3.2443740536818292E7,"quantile95":7.040412475524496E7,"stdDevCapital":2.4896660933671504E7,"var":4701642.24250662,"year":2055},{"averageCapital":2.853149916099863E7,"cumulativeGrowthRate":9.86914876001157,"cvar":3361043.7597212405,"maxCapital":4.402125998588515E8,"medianCapital":2.0207192961823344E7,"minCapital":0.0,"negativeCapitalPercentage":0.01,"phaseName":"Withdraw","quantile25":1.1353845512015501E7,"quantile5":4780695.780236489,"quantile75":3.57704456389094E7,"quantile95":7.89256955647023E7,"stdDevCapital":2.844200753517187E7,"var":4780695.780236489,"year":2056},{"averageCapital":3.1296110595202595E7,"cumulativeGrowthRate":9.689681634335813,"cvar":3331973.8895549993,"maxCapital":4.449959748978649E8,"medianCapital":2.172372293274156E7,"minCapital":0.0,"negativeCapitalPercentage":0.01,"phaseName":"Withdraw","quantile25":1.2008737845422471E7,"quantile5":4867045.810574813,"quantile75":3.914895458293706E7,"quantile95":8.909065107981814E7,"stdDevCapital":3.1852393362450603E7,"var":4867045.810574813,"year":2057},{"averageCapital":3.4409564868511595E7,"cumulativeGrowthRate":9.948374459624599,"cvar":3307354.186377334,"maxCapital":4.3531991741668713E8,"medianCapital":2.363070862840209E7,"minCapital":0.0,"negativeCapitalPercentage":0.01,"phaseName":"Withdraw","quantile25":1.2638258227297314E7,"quantile5":4974129.436083344,"quantile75":4.292423480383378E7,"quantile95":1.0005171631157555E8,"stdDevCapital":3.581209905326451E7,"var":4974129.436083344,"year":2058},{"averageCapital":3.811691294133262E7,"cumulativeGrowthRate":10.774178885980756,"cvar":3286922.3102756147,"maxCapital":6.135241674323771E8,"medianCapital":2.566454347302618E7,"minCapital":0.0,"negativeCapitalPercentage":0.03,"phaseName":"Withdraw","quantile25":1.335474631041759E7,"quantile5":5065527.834883575,"quantile75":4.74030181317302E7,"quantile95":1.1215689289303179E8,"stdDevCapital":4.1510094036735505E7,"var":5065527.834883575,"year":2059},{"averageCapital":4.217941338973191E7,"cumulativeGrowthRate":10.65799965136749,"cvar":3259129.2379653277,"maxCapital":6.004451383382416E8,"medianCapital":2.738302134492405E7,"minCapital":0.0,"negativeCapitalPercentage":0.09,"phaseName":"Withdraw","quantile25":1.4113151130491585E7,"quantile5":5197623.257163011,"quantile75":5.2584362418999165E7,"quantile95":1.2811152519073755E8,"stdDevCapital":4.762483515191489E7,"var":5197623.257163011,"year":2060},{"averageCapital":4.663020229530197E7,"cumulativeGrowthRate":10.552040789295457,"cvar":3216295.6913685245,"maxCapital":6.920455532322565E8,"medianCapital":2.973771434079792E7,"minCapital":0.0,"negativeCapitalPercentage":0.16,"phaseName":"Withdraw","quantile25":1.5020125381557064E7,"quantile5":5153393.795184987,"quantile75":5.735595391580041E7,"quantile95":1.4396440388062802E8,"stdDevCapital":5.426700178772445E7,"var":5153393.795184987,"year":2061},{"averageCapital":5.1587766490713276E7,"cumulativeGrowthRate":10.631659206657119,"cvar":3182122.3397138854,"maxCapital":7.925191611614474E8,"medianCapital":3.2474025748015523E7,"minCapital":0.0,"negativeCapitalPercentage":0.2,"phaseName":"Withdraw","quantile25":1.5976960630619783E7,"quantile5":5180216.27413294,"quantile75":6.400481230004816E7,"quantile95":1.6135156879990283E8,"stdDevCapital":6.195206369740735E7,"var":5180216.27413294,"year":2062},{"averageCapital":5.686211080906908E7,"cumulativeGrowthRate":10.224021463122046,"cvar":3103637.6165828006,"maxCapital":8.836226569602244E8,"medianCapital":3.527399823564722E7,"minCapital":0.0,"negativeCapitalPercentage":0.31,"phaseName":"Withdraw","quantile25":1.690376556157484E7,"quantile5":5215462.59592535,"quantile75":7.026267584193942E7,"quantile95":1.8034620282645732E8,"stdDevCapital":7.012977199104221E7,"var":5215462.59592535,"year":2063},{"averageCapital":6.311295142466765E7,"cumulativeGrowthRate":10.9929802581328,"cvar":3039390.814661682,"maxCapital":1.2153653527206528E9,"medianCapital":3.878576093976282E7,"minCapital":0.0,"negativeCapitalPercentage":0.39,"phaseName":"Withdraw","quantile25":1.7931987437448904E7,"quantile5":5352569.0140604,"quantile75":7.733628301556663E7,"quantile95":1.9965076504313534E8,"stdDevCapital":8.14988198208729E7,"var":5352569.0140604,"year":2064},{"averageCapital":6.984587785435244E7,"cumulativeGrowthRate":10.668058263320646,"cvar":2977443.025361685,"maxCapital":1.4522843082091098E9,"medianCapital":4.147662076286687E7,"minCapital":0.0,"negativeCapitalPercentage":0.46,"phaseName":"Withdraw","quantile25":1.9178009368687827E7,"quantile5":5339678.871499484,"quantile75":8.515301062243637E7,"quantile95":2.172978921093135E8,"stdDevCapital":9.260374477213077E7,"var":5339678.871499484,"year":2065},{"averageCapital":7.728929687437868E7,"cumulativeGrowthRate":10.656919561592137,"cvar":2903373.054873843,"maxCapital":1.6888450392546432E9,"medianCapital":4.5041778518692575E7,"minCapital":0.0,"negativeCapitalPercentage":0.54,"phaseName":"Withdraw","quantile25":2.039361886267345E7,"quantile5":5419756.462262673,"quantile75":9.326859174409865E7,"quantile95":2.4521983404448307E8,"stdDevCapital":1.0522673370601913E8,"var":5419756.462262673,"year":2066},{"averageCapital":8.566640795454241E7,"cumulativeGrowthRate":10.838643148454796,"cvar":2805070.8100105105,"maxCapital":2.432357867975962E9,"medianCapital":4.915844934535731E7,"minCapital":0.0,"negativeCapitalPercentage":0.63,"phaseName":"Withdraw","quantile25":2.1780940861502286E7,"quantile5":5533434.823633498,"quantile75":1.0284791486179632E8,"quantile95":2.793409698075672E8,"stdDevCapital":1.202810061437835E8,"var":5533434.823633498,"year":2067},{"averageCapital":9.44096599497935E7,"cumulativeGrowthRate":10.206161556219984,"cvar":2684223.474454527,"maxCapital":2.190115100070097E9,"medianCapital":5.3702481983034655E7,"minCapital":0.0,"negativeCapitalPercentage":0.77,"phaseName":"Withdraw","quantile25":2.3206617769300207E7,"quantile5":5408801.15502064,"quantile75":1.1274419596958596E8,"quantile95":3.1187634970394623E8,"stdDevCapital":1.327500657846914E8,"var":5408801.15502064,"year":2068},{"averageCapital":1.0485665885306199E8,"cumulativeGrowthRate":11.065603783367228,"cvar":2635101.083438889,"maxCapital":2.4931632667815065E9,"medianCapital":5.813988948344112E7,"minCapital":0.0,"negativeCapitalPercentage":0.86,"phaseName":"Withdraw","quantile25":2.4744215000726234E7,"quantile5":5677562.585143366,"quantile75":1.2601517741411524E8,"quantile95":3.5484685908913475E8,"stdDevCapital":1.5098118847300258E8,"var":5677562.585143366,"year":2069},{"averageCapital":1.1672319509061988E8,"cumulativeGrowthRate":11.316912409145829,"cvar":2551915.0887562656,"maxCapital":2.95174753012965E9,"medianCapital":6.342021001652827E7,"minCapital":0.0,"negativeCapitalPercentage":1.01,"phaseName":"Withdraw","quantile25":2.678747553747033E7,"quantile5":5773824.479896014,"quantile75":1.3880117171890637E8,"quantile95":3.940146630438737E8,"stdDevCapital":1.7274900616988796E8,"var":5773824.479896014,"year":2070}
];

const initialRows: ExploreRow[] = [
  {
    id: 'SIM-EX-001',
    title: 'Provided Example',
    owner: 'Anonymous',
    inputs: {
      startDate: '2025-01-01',
      overallTaxRule: 'CAPITAL',
      taxPercentage: 42,
      phases: [
        {
          type: 'DEPOSIT',
          durationInMonths: 240,
          initialDeposit: 10000,
          monthlyDeposit: 10000,
          yearlyIncreasePercent: 2,
          taxRules: [],
        },
        {
          type: 'PASSIVE',
          durationInMonths: 60,
          taxRules: [],
        },
        {
          type: 'WITHDRAW',
          durationInMonths: 240,
          withdrawAmount: 10000,
          lowerVariationPercent: 0,
          upperVariationPercent: 0,
          taxRules: ['EXEMPTIONCARD', 'STOCKEXEMPTION'],
        },
      ],
    },
    outputs: SAMPLE_OUTPUTS,
    notes: 'Matches the structure you described.',
  },
];

const thBase: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 8px',
  borderBottom: '1px solid #3a3a3a',
  position: 'sticky',
  top: 0,
  background: 'inherit',
};

const tdBase: React.CSSProperties = {
  padding: '10px 8px',
  borderBottom: '1px solid #3a3a3a',
  verticalAlign: 'top',
};

const Em: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ display: 'inline-block', fontSize: 12, opacity: 0.75 }}>{children}</span>
);

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      border: '1px solid #444',
      fontSize: 12,
      marginRight: 6,
      marginBottom: 4,
    }}
  >
    {children}
  </span>
);

const money = (v?: number) =>
  typeof v === 'number'
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(v)
    : '—';

const pct = (v?: number) =>
  typeof v === 'number'
    ? `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
    : '—';

const pctVal = (v?: number) =>
  typeof v === 'number'
    ? `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
    : '—';


const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
};

const sumMonths = (phases: PhaseInput[]) =>
  phases.reduce((s, p) => s + (Number(p.durationInMonths) || 0), 0);

/** ---------- Inputs cell ---------- */
const PhaseBlock: React.FC<{ p: PhaseInput }> = ({ p }) => (
  <div
    style={{
      border: '1px solid #3a3a3a',
      borderRadius: 10,
      padding: '8px 10px',
      marginBottom: 8,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <strong style={{ fontSize: 14 }}>{p.type} - {p.durationInMonths} months</strong>
    </div>

    <div style={{ marginTop: 6 }}>
      {p.type === 'DEPOSIT' && (
        <>
          <div style={{ marginTop: 6 }}>
            <Em>Initial Deposit:</Em> {money(p.initialDeposit)}
          </div>
          <div style={{ marginTop: 6 }}>
            <Em>Monthly Deposit:</Em> {money(p.monthlyDeposit)}
          </div>
          <div style={{ marginTop: 6 }}>
            <Em>Yearly Increase %:</Em> {pct(p.yearlyIncreasePercent)}
          </div>
        </>
      )}

      {p.type === 'WITHDRAW' && (
        <>
          <div style={{ marginTop: 6 }}>
            <Em>Withdraw Amount:</Em> {money(p.withdrawAmount)}
          </div>
          <div style={{ marginTop: 6 }}>
            <Em>Lower Variation %:</Em> {pct(p.lowerVariationPercent)}
          </div>
          <div style={{ marginTop: 6 }}>
            <Em>Upper Variation %:</Em> {pct(p.upperVariationPercent)}
          </div>
        </>
      )}

      <div style={{ marginTop: 8 }}>
        <Em>Tax Exemptions</Em>
        <div style={{ marginTop: 4 }}>
          {p.taxRules?.includes('EXEMPTIONCARD') && <Chip>Exemption Card</Chip>}
          {p.taxRules?.includes('STOCKEXEMPTION') && <Chip>Stock Exemption</Chip>}
          {!p.taxRules?.length && <span style={{ opacity: 0.7 }}>None</span>}
        </div>
      </div>
    </div>
  </div>
);

const InputsCell: React.FC<{ inputs: SimulationInputs }> = ({ inputs }) => {
  const total = sumMonths(inputs.phases);
  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <Em>Start Date:</Em>
        <div>{fmtDate(inputs.startDate)}</div>
      </div>
      <div style={{ marginBottom: 6 }}>
        <Em>Tax Rule:</Em>
        <div>{inputs.overallTaxRule === 'CAPITAL' ? 'Capital Gains' : 'Notional Gains'}</div>
      </div>
      <div style={{ marginBottom: 6 }}>
        <Em>Tax %:</Em>
        <div>{pct(inputs.taxPercentage)}</div>
      </div>

      <div style={{ margin: '10px 0 6px', fontWeight: 600 }}>Phases Added</div>
      {inputs.phases.map((p, idx) => (
        <PhaseBlock key={idx} p={p} />
      ))}

      <div style={{ marginTop: 6, fontWeight: 600 }}>
        Total duration: {total}/1200 months
      </div>
    </div>
  );
};

/** ---------- Outputs cell ---------- */
const OutputsCell: React.FC<{ outputs: OutputPoint[] }> = ({ outputs }) => {
  // Group by phase, then pick *last* year per phase for a compact snapshot
  const byPhase = useMemo(() => {
    const map: Record<string, OutputPoint[]> = {};
    outputs.forEach(o => {
      const key = String(o.phaseName);
      map[key] ??= [];
      map[key].push(o);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.year - b.year));
    return map;
  }, [outputs]);

  const snapshot = Object.entries(byPhase).map(([phase, arr]) => {
    const last = arr[arr.length - 1];
    return { phase, last };
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        {snapshot.map(s => (
          <div
            key={s.phase}
            style={{
              border: '1px solid #3a3a3a',
              borderRadius: 10,
              padding: '8px 10px',
              minWidth: 220,
              flex: '1 1 260px',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              {s.phase} - {s.last.year}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 10, rowGap: 4 }}>
              <Em>Median:</Em><div>{money(s.last.medianCapital)}</div>
              <Em>Avg:</Em><div>{money(s.last.averageCapital)}</div>
              <Em>Q25–Q75:</Em><div>{money(s.last.quantile25)}–{money(s.last.quantile75)}</div>
              <Em>Q5–Q95:</Em><div>{money(s.last.quantile5)}–{money(s.last.quantile95)}</div>
              <Em>Min/Max:</Em><div>{money(s.last.minCapital)} / {money(s.last.maxCapital)}</div>
              <Em>Neg:</Em><div>{pctVal(s.last.negativeCapitalPercentage)}</div>
              <Em>VaR(5%):</Em><div>{money(s.last.var)}</div>
              <Em>CVaR:</Em><div>{money(s.last.cvar)}</div>
            </div>
          </div>
        ))}
      </div>

      <details>
        <summary style={{ cursor: 'pointer' }}>Show raw outputs (JSON)</summary>
        <pre
          style={{
            marginTop: 8,
            maxHeight: 260,
            overflow: 'auto',
            border: '1px solid #3a3a3a',
            borderRadius: 10,
            padding: 8,
          }}
        >
{JSON.stringify(outputs, null, 2)}
        </pre>
      </details>
    </div>
  );
};

const ExplorePage: React.FC = () => {
  // Under development banner
  const [ack, setAck] = useState(false);

  // (Optional) simple search across inputs text
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialRows;
    return initialRows.filter(r => {
      const blob = [
        r.id,
        r.title ?? '',
        r.owner ?? '',
        r.inputs.startDate,
        r.inputs.overallTaxRule,
        r.inputs.taxPercentage,
        ...r.inputs.phases.map(p => `${p.type} ${p.durationInMonths}`),
      ].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [query]);

  return (
    <div style={{ minHeight: '100vh', padding: 16, maxWidth: 1500, margin: '0 auto' }}>
      {/* Under development disclaimer */}
      {!ack && (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            border: '1px solid #ffc10755',
            background: 'linear-gradient(0deg, rgba(255,193,7,0.08), rgba(255,193,7,0.08))',
            borderRadius: 10,
          }}
        >
          <strong>Explore (beta):</strong> This page is under development. Data is sample-only;
          filters, pagination, downloads, and “clone to form” are not final.
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setAck(true)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #444',
                backgroundColor: '#2e2e2e',
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <h2 style={{ margin: '8px 0 12px' }}>Explore Simulations</h2>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Search inputs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            minWidth: 260,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid #444',
            background: 'transparent',
            color: 'inherit',
          }}
        />
        <div style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.8 }}>
          {rows.length} result{rows.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Table: Inputs | Outputs | Actions */}
      <div style={{ overflow: 'auto', border: '1px solid #3a3a3a', borderRadius: 10, maxHeight: '70vh' }}>
        <table role="grid" style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '45%' }} />
            <col style={{ width: '45%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={thBase}>Inputs</th>
              <th style={thBase}>Outputs</th>
              <th style={thBase}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={tdBase}>
                  <InputsCell inputs={r.inputs} />
                </td>
                <td style={tdBase}>
                  <OutputsCell outputs={r.outputs} />
                </td>
                <td style={{ ...tdBase, width: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button type="button" title="Open details (coming soon)" disabled style={{ padding: '6px 8px' }}>
                      View
                    </button>
                    <button type="button" title="Clone into form (coming soon)" disabled style={{ padding: '6px 8px' }}>
                      Clone
                    </button>
                    <button type="button" title="Download CSV (coming soon)" disabled style={{ padding: '6px 8px' }}>
                      CSV
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td style={{ ...tdBase, textAlign: 'center' }} colSpan={3}>
                  No results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
        Pagination, server data, and cloning are in progress.
      </div>
    </div>
  );
};

export default ExplorePage;
