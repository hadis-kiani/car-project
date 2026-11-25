/* ============================================================
   NIRO CITY — Data: cars, tracks, upgrades, save system
   نیترو سیتی — کاتالوگ ماشین‌ها، مسیرها و ذخیرهٔ بازی
   ============================================================ */
(function (root) {
  'use strict';

  /* ---------- رنگ‌های بدنه ---------- */
  var PAINTS = [
    { id: 'rosso',   name: 'قرمز جهنمی',   hex: '#c1121f' },
    { id: 'giallo',  name: 'زرد آفتابی',   hex: '#ffb703' },
    { id: 'arancio', name: 'نارنجی کورسا', hex: '#fb5607' },
    { id: 'verde',   name: 'سبز بریتانیا', hex: '#0f7b3d' },
    { id: 'azzurro', name: 'آبی مسابقه',   hex: '#1d6fd1' },
    { id: 'blu',     name: 'سرمه‌ای شب',   hex: '#12294a' },
    { id: 'viola',   name: 'بنفش سلطنت',   hex: '#5a189a' },
    { id: 'nero',    name: 'مشکی شبح',     hex: '#0b0b0e' },
    { id: 'bianco',  name: 'سفید مرواریدی',hex: '#e9e9ec' },
    { id: 'argento', name: 'نقره‌ای مایع', hex: '#b9bec7' },
    { id: 'grigio',  name: 'خاکستری توفان',hex: '#4a4e57' },
    { id: 'oro',     name: 'طلایی سلطنتی', hex: '#c9a227' },
    { id: 'bronzo',  name: 'برنزی کلاسیک', hex: '#8a5a2b' },
    { id: 'rosa',    name: 'صورتی فلمینگو',hex: '#ff5da2' }
  ];

  var FINISHES = [
    { id: 'gloss', name: 'براق' },
    { id: 'matte', name: 'مات' },
    { id: 'pearl', name: 'مرواریدی' }
  ];

  var RIMS = [
    { id: 'sport',   name: 'اسپرت ۵‌پره' },
    { id: 'mesh',    name: 'توری مسابقه‌ای' },
    { id: 'steel',   name: 'کلاسیک فلزی' },
    { id: 'turbine', name: 'توربینی لوکس' }
  ];
  var RIM_COLORS = [
    { id: 'silver', name: 'نقره‌ای', hex: '#d7d9de' },
    { id: 'black',  name: 'مشکی',    hex: '#151517' },
    { id: 'gold',   name: 'طلایی',   hex: '#d4af37' }
  ];

  var TIRES = [
    { id: 'street', name: 'خیابانی',       grip: 0.0, brake: 0.0, desc: 'تعادل عالی برای شهر' },
    { id: 'sport',  name: 'اسپرت',         grip: 0.35, brake: 0.25, desc: 'چسبندگی بیشتر در پیچ‌ها' },
    { id: 'slick',  name: 'اسلیک مسابقه‌ای', grip: 0.7, brake: 0.5, desc: 'حداکثر چسبندگی پیست' }
  ];

  var GLOWS = [
    { id: 'none',    name: 'بدون نور', hex: null },
    { id: 'cyan',    name: 'آبی نئون', hex: '#00e5ff' },
    { id: 'magenta', name: 'صورتی نئون', hex: '#ff2fd6' },
    { id: 'lime',    name: 'سبز لیمویی', hex: '#7CFC00' },
    { id: 'orange',  name: 'نارنجی',   hex: '#ff7a00' },
    { id: 'violet',  name: 'بنفش',     hex: '#9d4edd' },
    { id: 'ice',     name: 'سفید یخی', hex: '#cfe8ff' }
  ];

  /* ---------- کاتالوگ ماشین‌ها ---------- */
  /* stat ها: 0..100 — cls: sports/racing/super/hyper/luxury/classic/muscle */
  var CARS = [
    { id:'mx5', brand:'Mazda', name:'ام‌اکس-۵ میات', model:'MX-5 Miata ND', cls:'sports', body:'sport', year:2019, price:0,
      speed:62, accel:52, handling:86, braking:66, topKmh:204, rarity:'common',
      desc:'خالص‌ترین خودروی لذت رانندگی دنیا؛ سبک، چابک و اعتیادآور.', owned:true },
    { id:'supra', brand:'Toyota', name:'سوپرا A80', model:'Supra A80 1998', cls:'sports', body:'sport', year:1998, price:0,
      speed:73, accel:71, handling:73, braking:68, topKmh:250, rarity:'rare',
      desc:'افسانهٔ JDM با توربوشارژر تویین؛ پادشاه دریفت خیابانی.', owned:true },
    { id:'mustang', brand:'Ford', name:'موستانگ GT', model:'Mustang GT Fastback', cls:'muscle', body:'muscle', year:2021, price:42000,
      speed:71, accel:70, handling:62, braking:64, topKmh:250, rarity:'common',
      desc:'صدای V8 آمریکایی با کاپوت بلند و دم کوتاه؛ روح دیترویت.' },
    { id:'hellcat', brand:'Dodge', name:'چلنجر هل‌کت', model:'Challenger SRT Hellcat', cls:'muscle', body:'muscle', year:2020, price:68000,
      speed:79, accel:83, handling:55, braking:70, topKmh:290, rarity:'rare',
      desc:'۷۱۷ اسب بخار خشم؛ موشکی که بوی ابرنادود می‌دهد.' },
    { id:'gtr', brand:'Nissan', name:'جی‌تی‌آر R35', model:'GT-R R35 Nismo', cls:'sports', body:'sport', year:2022, price:78000,
      speed:82, accel:86, handling:82, braking:85, topKmh:315, rarity:'rare',
      desc:'«گودزیلا»؛ گشتاور تمام‌چرخ محرک برای بیرون‌کشیدن از هر پیچ.' },
    { id:'corvette', brand:'Chevrolet', name:'کوروت C8', model:'Corvette Stingray C8', cls:'sports', body:'super', year:2022, price:85000,
      speed:84, accel:83, handling:77, braking:78, topKmh:312, rarity:'rare',
      desc:'موتور وسط آمریکایی با صدای شلیک از وسط کابین.' },
    { id:'etype', brand:'Jaguar', name:'ای-تایپ', model:'E-Type Series 1', cls:'classic', body:'classic', year:1963, price:88000,
      speed:58, accel:52, handling:68, braking:52, topKmh:217, rarity:'epic',
      desc:'زیباترین خودروی تاریخ به‌گفتهٔ انزو فراری. آثار هنری متحرک.' },
    { id:'porsche930', brand:'Porsche', name:'۹۱۱ توربو «بوفربان»', model:'911 Turbo 930', cls:'classic', body:'classic', year:1986, price:95000,
      speed:68, accel:66, handling:62, braking:58, topKmh:245, rarity:'epic',
      desc:'افسانهٔ توربوی دههٔ هشتاد با بال نهنگ و دم خوکچه‌ای کودکانه.' },
    { id:'db11', brand:'Aston Martin', name:'دی‌بی ۱۱', model:'DB11 V12', cls:'luxury', body:'luxury', year:2021, price:105000,
      speed:80, accel:76, handling:74, braking:76, topKmh:322, rarity:'rare',
      desc:'گرندتورر بریتانیایی با صدای V12 و کابینی از چرم و آلکانتارا.' },
    { id:'gt3rs', brand:'Porsche', name:'۹۱۱ GT3 آر‌اس', model:'911 GT3 RS 992', cls:'racing', body:'super', year:2023, price:145000,
      speed:90, accel:88, handling:93, braking:94, topKmh:296, rarity:'epic',
      desc:'ماشین مسابقهٔ تنخورده؛ هوای فعال، دیسک کربن و قلب تنفس طبیعی.' },
    { id:'continental', brand:'Bentley', name:'کانتیننتال GT', model:'Continental GT Speed', cls:'luxury', body:'luxury', year:2023, price:160000,
      speed:82, accel:82, handling:70, braking:80, topKmh:333, rarity:'epic',
      desc:'سریع‌ترین گرندتورر چهار نفرهٔ دنیا؛ سالن VIP متحرک با W12.' },
    { id:'720s', brand:'McLaren', name:'۷۲۰ اس', model:'720S Spider', cls:'super', body:'super', year:2021, price:178000,
      speed:93, accel:92, handling:86, braking:88, topKmh:341, rarity:'epic',
      desc:'فیبرکربن سیاه، بال‌های پروانه‌ای و دود شش‌سطحی از اگزوز.' },
    { id:'f8', brand:'Ferrari', name:'اف ۸ تریبوتو', model:'F8 Tributo', cls:'super', body:'super', year:2022, price:190000,
      speed:92, accel:93, handling:88, braking:87, topKmh:340, rarity:'epic',
      desc:'ادای احترام مارانلو به دوران V8 توربو؛ فرمی آتشین و خروشی خیره‌کننده.' },
    { id:'fordgt', brand:'Ford', name:'فورد جی‌تی', model:'GT Carbon', cls:'super', body:'super', year:2020, price:210000,
      speed:91, accel:90, handling:83, braking:85, topKmh:347, rarity:'epic',
      desc:'ماشین لو ماند ۲۰۱۶ در خیابان؛ پروانه‌های فعال و پوستهٔ فیبرکربن.' },
    { id:'huracan', brand:'Lamborghini', name:'هوراکان ایوو', model:'Huracán EVO', cls:'super', body:'super', year:2022, price:240000,
      speed:94, accel:93, handling:89, braking:90, topKmh:325, rarity:'legendary',
      desc:'شکل تهاجمی گاو خشمگین ایتالیایی؛ هر نمایشش یک نمایش آتش است.' },
    { id:'gto250', brand:'Ferrari', name:'۲۵۰ جی‌تی‌او', model:'250 GTO 1962', cls:'classic', body:'classic', year:1962, price:320000,
      speed:81, accel:77, handling:86, braking:73, topKmh:280, rarity:'legendary',
      desc:'کیمیای مارانلو؛ کمیاب‌ترین و ارزشمندترین خودروی مسابقهٔ تاریخ.' },
    { id:'chiron', brand:'Bugatti', name:'شیرون', model:'Chiron Super Sport', cls:'hyper', body:'hyper', year:2022, price:450000,
      speed:100, accel:100, handling:84, braking:92, topKmh:420, rarity:'legendary',
      desc:'۱۵۷۸ اسب بخار W16 با سرعت ۴۲۰؛ نقطهٔ اوج مهندسی بشریت.' },
    { id:'jesko', brand:'Koenigsegg', name:'جسکو', model:'Jesko Absolut', cls:'hyper', body:'hyper', year:2023, price:480000,
      speed:100, accel:98, handling:91, braking:94, topKmh:531, rarity:'legendary',
      desc:'رکورددار نظری ۵۳۱ کیلومتر بر ساعت؛ موسیقی مکانیکی کامل سوئد.' }
  ];

  var CLASS_LABELS = {
    sports:  { name: 'اسپرت',     color: '#22d3ee' },
    muscle:  { name: 'ماسل',      color: '#fb7185' },
    racing:  { name: 'ریسینگ',    color: '#a3e635' },
    super:   { name: 'سوپر اسپرت',color: '#f97316' },
    hyper:   { name: 'هایپر کار', color: '#e879f9' },
    luxury:  { name: 'لوکس',      color: '#facc15' },
    classic: { name: 'کلاسیک',    color: '#d6a35c' }
  };
  var RARITY_LABELS = {
    common:    { name: 'معمولی',   color: '#9ca3af' },
    rare:      { name: 'کمیاب',    color: '#38bdf8' },
    epic:      { name: 'اپیک',     color: '#c084fc' },
    legendary: { name: 'افسانه‌ای',color: '#fbbf24' }
  };

  /* ---------- مسیرها ---------- */
  /* کنترل‌پوینت‌های منحنی بسته (متر) — y فقط در مسیر کوهستانی */
  var TRACKS = [
    {
      id: 'neoncity', name: 'خیابان نئون', en: 'NEON CITY CIRCUIT',
      desc: 'مدار شهری پر پیچ‌وتاب میان آسمان‌خراش‌ها و تابلوهای نئون',
      env: 'city', lengthKm: 2.05, width: 9.2, halfWidth: 4.6,
      lapsSuggested: 3, rewardBase: 2500,
      points: [
        [0,0,-228],[160,0,-228],[228,0,-160],[228,0,-46],[144,0,-18],[144,0,84],[228,0,144],[228,0,228],
        [91,0,271],[-30,0,228],[-144,0,271],[-246,0,213],[-228,0,68],[-144,0,-8],[-236,0,-122],[-182,0,-243],
        [-68,0,-271]
      ],
      scenery: 'city'
    },
    {
      id: 'sunset', name: 'بزرگراه غروب', en: 'SUNSET HIGHWAY',
      desc: 'بزرگراه عریض کویری با کشش سرعت و پیچ‌های بلند در غروب',
      env: 'desert', lengthKm: 3.1, width: 10.5, halfWidth: 5.25,
      lapsSuggested: 2, rewardBase: 2800,
      points: [
        [0,0,-347],[195,0,-325],[347,0,-195],[325,0,-33],[163,0,-11],[130,0,130],[260,0,238],[195,0,390],
        [22,0,358],[-43,0,195],[-217,0,163],[-358,0,325],[-423,0,130],[-304,0,-22],[-379,0,-195],[-271,0,-358],
        [-119,0,-325]
      ],
      scenery: 'desert'
    },
    {
      id: 'alborz', name: 'گردنه البرز', en: 'ALBORZ PASS',
      desc: 'جادهٔ کوهستانی باریک با ارتفاع و پیچ‌های تند؛ رانندگی خالص',
      env: 'mountain', lengthKm: 2.6, width: 8.6, halfWidth: 4.3,
      lapsSuggested: 2, rewardBase: 3000,
      points: [
        [0,0,-291],[166,4.05,-333],[312,10.8,-229],[343,17.55,-42],[229,24.3,83],[250,32.4,291],[83,36.45,395],[-125,32.4,333],
        [-250,27,187],[-187,21.6,0],[-333,16.2,-125],[-385,10.8,-312],[-229,5.4,-395],[-94,1.35,-312]
      ],
      scenery: 'mountain'
    }
  ];

  /* ---------- زمان‌های روز ---------- */
  var TOD = [
    { id: 'day',    name: 'روز',   icon: '☀' },
    { id: 'sunset', name: 'غروب',  icon: '🌇' },
    { id: 'night',  name: 'شب',    icon: '🌙' }
  ];

  /* ---------- ارتقای ماشین (۵ سطح) ---------- */
  var UPGRADES = [
    { id: 'engine', name: 'موتور',  desc: 'شتاب و حداکثر سرعت', per: '+12٪ توان / +4.5٪ سرعت در هر سطح' },
    { id: 'tires',  name: 'لاستیک', desc: 'چسبندگی و کنترل دریفت', per: '+۰.۵۵ گریپ در هر سطح' },
    { id: 'brakes', name: 'ترمز',   desc: 'قدرت توقف', per: '+13٪ قدرت ترمز در هر سطح' }
  ];
  var UPGRADE_MAX = 5;

  /* هزینهٔ هر سطح بر اساس قیمت پایهٔ ماشین (ماشین‌های گران‌تر، ارتقای گران‌تر) */
  function upgradeCost(carPrice, level) {
    var base = 550 + (carPrice / 1000) * 2.1;
    return Math.round((base * (1 + level * 0.92)) / 50) * 50;
  }

  /* جوایز رتبه (ضرب در ضریب دشواری) */
  var PLACE_REWARDS = [2500, 1800, 1300, 900, 700, 500, 400, 300];
  var DIFFICULTY = [
    { id: 'easy',   name: 'آسان',      skill: 0.64, reward: 0.8,  aiCount: 5 },
    { id: 'pro',    name: 'حرفه‌ای',   skill: 0.79, reward: 1.0,  aiCount: 7 },
    { id: 'legend', name: 'افسانه‌ای', skill: 0.90, reward: 1.35, aiCount: 7 }
  ];

  /* ---------- ذخیرهٔ بازی ---------- */
  var SAVE_KEY = 'nitrocity_save_v1';
  var DEFAULT_SAVE = {
    version: 1,
    coins: 30000,
    owned: ['mx5', 'supra'],
    selectedId: 'mx5',
    paints: {}, finishes: {}, rims: {}, rimColors: {}, tires: {}, glows: {},
    upgrades: {},            // carId -> {engine,tires,brakes}
    bestLaps: {},            // trackId -> seconds
    bestTotal: {},
    stats: { wins: 0, races: 0, driftBest: 0 },
    settings: { tod: 'night', difficulty: 'pro', quality: 'high', camera: 'chase', muted: false }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function loadSave() {
    try {
      var raw = root.localStorage && root.localStorage.getItem(SAVE_KEY);
      if (!raw) return clone(DEFAULT_SAVE);
      var s = JSON.parse(raw);
      var d = clone(DEFAULT_SAVE);
      // مرج امن برای فیلدهای جدید
      Object.keys(d).forEach(function (k) { if (s[k] === undefined) s[k] = d[k]; });
      Object.keys(d.settings).forEach(function (k) { if (!s.settings || s.settings[k] === undefined) s.settings[k] = d.settings[k]; });
      Object.keys(d.stats).forEach(function (k) { if (!s.stats || s.stats[k] === undefined) s.stats[k] = d.stats[k]; });
      return s;
    } catch (e) {
      return clone(DEFAULT_SAVE);
    }
  }
  function saveSave(s) {
    try { root.localStorage && root.localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }
  function resetSave() {
    try { root.localStorage && root.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    return clone(DEFAULT_SAVE);
  }

  function getCar(id) { return CARS.find(function (c) { return c.id === id; }) || CARS[0]; }
  function carPaint(save, id)  { return save.paints[id]  || '#c1121f'; }
  function carFinish(save, id) { return save.finishes[id] || 'gloss'; }
  function carRim(save, id)    { return save.rims[id]    || (getCar(id).cls === 'classic' ? 'steel' : 'sport'); }
  function carRimColor(save,id){ return save.rimColors[id] || 'silver'; }
  function carTire(save, id)   { return save.tires[id]   || 'street'; }
  function carGlow(save, id)   { return save.glows[id]   || 'none'; }
  function carUpgrades(save,id){ var u = save.upgrades[id]; return u ? { engine:u.engine||0, tires:u.tires||0, brakes:u.brakes||0 } : { engine:0, tires:0, brakes:0 }; }

  /* آمار مؤثر بعد از ارتقا */
  function effectiveStats(car, save) {
    var u = carUpgrades(save, car.id);
    var t = carTire(save, car.id);
    var tire = TIRES.find(function(x){return x.id===t;}) || TIRES[0];
    var powerMul = 1 + 0.12 * u.engine;
    var topMul   = 1 + 0.045 * u.engine;
    return {
      topKmh:   Math.round(car.topKmh * topMul),
      accel:    (5.0 + Math.pow(car.accel / 100, 1.12) * 8.6) * powerMul,   // m/s^2
      grip:     5.6 + (car.handling / 100) * 4.6 + u.tires * 0.55 + tire.grip,
      yawGain:  0.95 + (car.handling / 100) * 0.85 + u.tires * 0.03,
      brake:    (8.0 + (car.braking / 100) * 9.5) * (1 + 0.13 * u.brakes) + tire.brake * 2,
      driftBonus: u.tires * 0.12 + tire.grip * 0.35,
      engineMul: powerMul, topMul: topMul, upgrades: u
    };
  }

  root.NitroData = {
    PAINTS, FINISHES, RIMS, RIM_COLORS, TIRES, GLOWS,
    CARS, CLASS_LABELS, RARITY_LABELS,
    TRACKS, TOD, UPGRADES, UPGRADE_MAX, upgradeCost,
    PLACE_REWARDS, DIFFICULTY,
    SAVE_KEY, DEFAULT_SAVE, loadSave, saveSave, resetSave,
    getCar, carPaint, carFinish, carRim, carRimColor, carTire, carGlow, carUpgrades, effectiveStats
  };
})(typeof window !== 'undefined' ? window : globalThis);
