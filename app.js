"use strict";
(() => {
  // src/lib/guardrails.ts
  var CENSUS_HINTS = [
    "population",
    "people",
    "resident",
    "residents",
    "census",
    "demographic",
    "demographics",
    "county",
    "counties",
    "state",
    "states",
    "city",
    "cities",
    "town",
    "place",
    "metro",
    "tract",
    "block group",
    "median age",
    "age",
    "income",
    "poverty",
    "race",
    "ethnicity",
    "household",
    "households",
    "male",
    "female",
    "men",
    "women",
    "hispanic",
    "latino",
    "white",
    "black",
    "asian",
    "california",
    "texas",
    "florida",
    "new york"
  ];
  var HARD_OFF_TOPIC = [
    "recipe",
    "weather",
    "forecast",
    "horoscope",
    "astrology",
    "lyrics",
    "dating",
    "girlfriend",
    "boyfriend",
    // State trivia that isn't Census demographics ("capital of Texas", "governor of
    // California"). Refused even though a state is named.
    "capital",
    "governor",
    "governors",
    "mayor",
    "senator",
    "senators",
    "congressman",
    "congresswoman",
    "president",
    "time zone",
    "timezone",
    "square miles",
    "land area",
    "flag",
    "motto",
    "nickname",
    "anthem",
    "abbreviation"
  ];
  var SOFT_OFF_TOPIC = [
    "stock",
    "stocks",
    "crypto",
    "cryptocurrency",
    "bitcoin",
    "sports",
    "football",
    "basketball",
    "baseball",
    "soccer",
    "movie",
    "movies",
    "film",
    "music",
    "song",
    "songs",
    "joke",
    "homework",
    "novel",
    "translate"
  ];
  var UNSAFE_HINTS = [
    "password",
    "passwords",
    "secret",
    "secrets",
    "api key",
    "apikey",
    "access token",
    "credential",
    "credentials",
    "private key",
    "exploit",
    "malware",
    "ransomware"
  ];
  var GENERATION_VERB = /\b(write|compose|draft|generate|create|build|make)\b/;
  var CREATIVE_OR_CODE_NOUN = /\b(poem|poems|story|stories|essay|essays|haiku|song|songs|rap|novel|sonnet|limerick|joke|jokes|lyrics|screenplay|code|program|programs|function|functions|script|scripts|sql|query|queries|regex|app|application)\b/;
  var INJECTION_PATTERNS = [
    /\b(ignore|disregard|forget|override|bypass)\b[^.?!]{0,40}\b(previous|prior|earlier|above|all|any)\b[^.?!]{0,20}\b(instruction|instructions|prompt|prompts|rule|rules|message|messages)\b/,
    // "ignore your rules", "bypass the guardrails", "disregard the instructions"
    /\b(ignore|disregard|forget|override|bypass)\b[^.?!]{0,20}\b(rule|rules|instruction|instructions|prompt|prompts|guardrail|guardrails|system|filter|filters)\b/,
    /\b(ignore|disregard|forget)\b[^.?!]{0,20}\b(everything|all)\b/,
    /\b(reveal|show|print|repeat|expose|leak|tell me)\b[^.?!]{0,30}\b(system prompt|your prompt|the prompt|your instructions|your rules|system message)\b/,
    // Role reassignment: "you are now/a/an X", "forget you are", "stop being", DAN, etc.
    /\b(you are (now|not|no longer|a|an)|from now on|act as|pretend (to be|you are|that you)|roleplay as|role-play as|behave like|forget (that )?you('?re| are)|stop being)\b/,
    /\b(developer mode|dan mode|jailbreak|sudo mode|god mode|unfiltered mode|without (any )?(restrictions|filters|guardrails))\b/,
    /\b(new|updated) (system )?(instructions|prompt|rules)\b\s*[:=]/,
    // Common non-English injection verbs (FR/ES/DE). Comprehensive multilingual
    // coverage needs a classifier; this catches the obvious cases.
    /\b(ignorez|oubliez|ignora|olvida|ignoriere|vergiss|r[eé]v[eé]lez|revela|enth[uü]lle)\b/
  ];
  function normalizeForMatch(input) {
    return ` ${input.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()} `;
  }
  function hasPhrase(paddedHaystack, phrase) {
    return paddedHaystack.includes(` ${phrase} `);
  }
  function deleet(input) {
    return input.replace(/@/g, "a").replace(/\$/g, "s").replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t");
  }
  function checkGuardrails(question) {
    const raw = question.toLowerCase();
    const deleeted = deleet(raw);
    const padded = normalizeForMatch(question);
    const paddedDeleet = normalizeForMatch(deleeted);
    if (INJECTION_PATTERNS.some((pattern) => pattern.test(raw) || pattern.test(deleeted))) {
      return {
        allowed: false,
        reason: "prompt_injection",
        message: "I can't follow instructions that try to change my role or reveal my configuration. I answer US Census population and demographic questions \u2014 ask me one of those and I'm happy to help."
      };
    }
    if (UNSAFE_HINTS.some((hint) => hasPhrase(padded, hint) || hasPhrase(paddedDeleet, hint))) {
      return {
        allowed: false,
        reason: "unsafe",
        message: "I can't help with credentials, secrets, or unsafe requests. I can answer US Census population and demographic questions instead."
      };
    }
    const looksCensusRelated = CENSUS_HINTS.some((hint) => hasPhrase(padded, hint));
    const hardOffTopic = HARD_OFF_TOPIC.some((hint) => hasPhrase(padded, hint));
    const creativeTask = GENERATION_VERB.test(raw) && CREATIVE_OR_CODE_NOUN.test(raw);
    const softOffTopic = SOFT_OFF_TOPIC.some((hint) => hasPhrase(padded, hint));
    if (hardOffTopic || creativeTask || softOffTopic && !looksCensusRelated) {
      return {
        allowed: false,
        reason: "off_topic",
        message: "I only answer questions grounded in US Census population and demographic data. Try asking about population, age, income, poverty, race, or a specific state, county, or city."
      };
    }
    return { allowed: true };
  }

  // src/lib/metrics.ts
  var METRICS = {
    total_population: {
      label: "Total population",
      variable: "DP05_0001E",
      unit: "count",
      group: "DP05",
      aliases: ["population", "populations", "people", "residents", "inhabitants", "populous"]
    },
    male_population: {
      label: "Male population",
      variable: "DP05_0002E",
      unit: "count",
      group: "DP05",
      aliases: ["male", "men", "males"]
    },
    female_population: {
      label: "Female population",
      variable: "DP05_0003E",
      unit: "count",
      group: "DP05",
      aliases: ["female", "women", "females"]
    },
    median_age: {
      label: "Median age",
      variable: "DP05_0018E",
      unit: "years",
      group: "DP05",
      aliases: ["median age", "age"]
    },
    median_household_income: {
      label: "Median household income",
      variable: "DP03_0062E",
      unit: "dollars",
      group: "DP03",
      aliases: ["median income", "household income", "median household income"]
    },
    per_capita_income: {
      label: "Per capita income",
      variable: "DP03_0088E",
      unit: "dollars",
      group: "DP03",
      aliases: ["per capita income"]
    },
    poverty_rate: {
      label: "Poverty rate",
      variable: "DP03_0128PE",
      unit: "percent",
      group: "DP03",
      aliases: ["poverty", "poverty rate", "below poverty"]
    },
    white_population: {
      label: "White population",
      variable: "DP05_0037E",
      unit: "count",
      group: "DP05",
      aliases: ["white"]
    },
    black_population: {
      label: "Black or African American population",
      variable: "DP05_0038E",
      unit: "count",
      group: "DP05",
      aliases: ["black", "african american"]
    },
    asian_population: {
      label: "Asian population",
      variable: "DP05_0044E",
      unit: "count",
      group: "DP05",
      aliases: ["asian"]
    },
    hispanic_population: {
      label: "Hispanic or Latino population",
      variable: "DP05_0073E",
      unit: "count",
      group: "DP05",
      aliases: ["hispanic", "latino", "latina"]
    }
  };
  function formatValue(value, unit) {
    if (value === null || Number.isNaN(value)) return "not available";
    if (unit === "dollars") return `$${Math.round(value).toLocaleString("en-US")}`;
    if (unit === "percent")
      return `${value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    if (unit === "years") return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} years`;
    if (unit === "ratio") return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
    return Math.round(value).toLocaleString("en-US");
  }

  // src/lib/states.ts
  var STATES = [
    { name: "Alabama", abbr: "AL", fips: "01" },
    { name: "Alaska", abbr: "AK", fips: "02" },
    { name: "Arizona", abbr: "AZ", fips: "04" },
    { name: "Arkansas", abbr: "AR", fips: "05" },
    { name: "California", abbr: "CA", fips: "06" },
    { name: "Colorado", abbr: "CO", fips: "08" },
    { name: "Connecticut", abbr: "CT", fips: "09" },
    { name: "Delaware", abbr: "DE", fips: "10" },
    { name: "District of Columbia", abbr: "DC", fips: "11" },
    { name: "Florida", abbr: "FL", fips: "12" },
    { name: "Georgia", abbr: "GA", fips: "13" },
    { name: "Hawaii", abbr: "HI", fips: "15" },
    { name: "Idaho", abbr: "ID", fips: "16" },
    { name: "Illinois", abbr: "IL", fips: "17" },
    { name: "Indiana", abbr: "IN", fips: "18" },
    { name: "Iowa", abbr: "IA", fips: "19" },
    { name: "Kansas", abbr: "KS", fips: "20" },
    { name: "Kentucky", abbr: "KY", fips: "21" },
    { name: "Louisiana", abbr: "LA", fips: "22" },
    { name: "Maine", abbr: "ME", fips: "23" },
    { name: "Maryland", abbr: "MD", fips: "24" },
    { name: "Massachusetts", abbr: "MA", fips: "25" },
    { name: "Michigan", abbr: "MI", fips: "26" },
    { name: "Minnesota", abbr: "MN", fips: "27" },
    { name: "Mississippi", abbr: "MS", fips: "28" },
    { name: "Missouri", abbr: "MO", fips: "29" },
    { name: "Montana", abbr: "MT", fips: "30" },
    { name: "Nebraska", abbr: "NE", fips: "31" },
    { name: "Nevada", abbr: "NV", fips: "32" },
    { name: "New Hampshire", abbr: "NH", fips: "33" },
    { name: "New Jersey", abbr: "NJ", fips: "34" },
    { name: "New Mexico", abbr: "NM", fips: "35" },
    { name: "New York", abbr: "NY", fips: "36" },
    { name: "North Carolina", abbr: "NC", fips: "37" },
    { name: "North Dakota", abbr: "ND", fips: "38" },
    { name: "Ohio", abbr: "OH", fips: "39" },
    { name: "Oklahoma", abbr: "OK", fips: "40" },
    { name: "Oregon", abbr: "OR", fips: "41" },
    { name: "Pennsylvania", abbr: "PA", fips: "42" },
    { name: "Rhode Island", abbr: "RI", fips: "44" },
    { name: "South Carolina", abbr: "SC", fips: "45" },
    { name: "South Dakota", abbr: "SD", fips: "46" },
    { name: "Tennessee", abbr: "TN", fips: "47" },
    { name: "Texas", abbr: "TX", fips: "48" },
    { name: "Utah", abbr: "UT", fips: "49" },
    { name: "Vermont", abbr: "VT", fips: "50" },
    { name: "Virginia", abbr: "VA", fips: "51" },
    { name: "Washington", abbr: "WA", fips: "53" },
    { name: "West Virginia", abbr: "WV", fips: "54" },
    { name: "Wisconsin", abbr: "WI", fips: "55" },
    { name: "Wyoming", abbr: "WY", fips: "56" },
    { name: "Puerto Rico", abbr: "PR", fips: "72" }
  ];
  function findState(input) {
    if (!input) return void 0;
    const normalized = normalize(input);
    return STATES.find(
      (state) => normalize(state.name) === normalized || state.abbr.toLowerCase() === normalized
    );
  }
  var AMBIGUOUS_ABBR = /* @__PURE__ */ new Set([
    "AL",
    "CO",
    "DE",
    "HI",
    "ID",
    "IN",
    "LA",
    "MA",
    "ME",
    "MI",
    "MO",
    "MS",
    "OH",
    "OK",
    "OR",
    "PA"
  ]);
  function findStatesInText(text) {
    const matches = [];
    for (const state of STATES) {
      const span = firstStateMention(text, state);
      if (span) matches.push({ state, ...span });
    }
    const kept = matches.filter(
      (match) => !matches.some(
        (other) => other !== match && other.start <= match.start && other.end >= match.end && other.end - other.start > match.end - match.start
      )
    );
    return kept.sort((a, b) => a.start - b.start).map((match) => match.state);
  }
  function firstStateMention(text, state) {
    const candidates = [];
    const nameMatch = new RegExp(`\\b${escapeRegExp(state.name)}\\b`, "i").exec(text);
    if (nameMatch) candidates.push({ start: nameMatch.index, end: nameMatch.index + nameMatch[0].length });
    const abbrPattern = AMBIGUOUS_ABBR.has(state.abbr) ? new RegExp(`,\\s*${state.abbr}(?![A-Za-z])`) : new RegExp(`(?<![A-Za-z])${state.abbr}(?![A-Za-z])`);
    const abbrMatch = abbrPattern.exec(text);
    if (abbrMatch) {
      const start = abbrMatch.index + abbrMatch[0].length - state.abbr.length;
      candidates.push({ start, end: start + state.abbr.length });
    }
    if (candidates.length === 0) return void 0;
    return candidates.sort((a, b) => a.start - b.start)[0];
  }
  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function normalize(input) {
    return input.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  }

  // src/lib/planner.ts
  var DEFAULT_YEAR = 2022;
  var MIN_SUPPORTED_YEAR = 2009;
  var MAX_SUPPORTED_YEAR = 2022;
  function planQuery(messages) {
    const current = messages.at(-1)?.content ?? "";
    const context = userTurns(messages).map((message) => message.content).join("\n");
    const requestedYear = detectYear(current);
    if (requestedYear !== void 0) {
      if (requestedYear > MAX_SUPPORTED_YEAR) {
        return {
          clarification: `I report measured US Census/ACS estimates (through ${MAX_SUPPORTED_YEAR}); I can't project future years like ${requestedYear}.`
        };
      }
      if (requestedYear < MIN_SUPPORTED_YEAR) {
        return {
          clarification: `I have ACS 5-year estimates from ${MIN_SUPPORTED_YEAR} to ${MAX_SUPPORTED_YEAR}; I don't have data for ${requestedYear}.`
        };
      }
    }
    if (/\b(projected|projection|projections|forecast|forecasted|next decade|coming decade|future population|in the future|decades? from now|years from now)\b/i.test(current)) {
      return {
        clarification: `I report measured US Census/ACS estimates (through ${MAX_SUPPORTED_YEAR}); I can't project future population values.`
      };
    }
    if (/\b(virgin islands|u\.?\s?s\.?\s?v\.?\s?i|guam|american samoa|northern mariana|mariana islands)\b/i.test(current)) {
      return {
        clarification: "I cover the 50 states, DC, and Puerto Rico \u2014 not other US territories such as the US Virgin Islands, Guam, American Samoa, or the Northern Mariana Islands."
      };
    }
    const currentMetrics = detectMetrics(current);
    const onlyGenericMetric = currentMetrics.length > 0 && currentMetrics.every((metric) => metric === "total_population" || metric === "median_age");
    const unsupported = unsupportedConcept(current);
    if (currentMetrics.length === 0 || onlyGenericMetric) {
      if (unsupported) {
        return {
          clarification: `I can report population (total, by sex, and by race/Hispanic origin), median age, median household income, per-capita income, and poverty rate \u2014 but not ${unsupported}. Which of those would help?`
        };
      }
      if (mentionsIncome(current)) {
        return {
          clarification: "Which income measure would you like \u2014 median household income or per capita income?"
        };
      }
    }
    const COUNT_ONLY_METRICS = [
      "total_population",
      "male_population",
      "female_population",
      "white_population",
      "black_population",
      "asian_population",
      "hispanic_population"
    ];
    if (/\b(percent|percentage|share|fraction|proportion)\b/.test(normalize(current)) && currentMetrics.length > 0 && currentMetrics.every((metric) => COUNT_ONLY_METRICS.includes(metric))) {
      return {
        clarification: "I report population as counts, not percentages, for sex and race (poverty rate is the only percentage I have). I can give you the counts and the total \u2014 would that work?"
      };
    }
    const previousMetrics = detectMetrics(context);
    const metrics = currentMetrics.length > 0 ? currentMetrics : previousMetrics.length > 0 ? previousMetrics : ["total_population"];
    const notes = [];
    if (unsupported && currentMetrics.length > 0 && !onlyGenericMetric) {
      notes.push(`I can't provide ${unsupported}, so I answered the parts I can.`);
    }
    let operation = detectOperation(current);
    const limit = detectLimit(current);
    let geographies = detectGeographies(current, operation);
    if (geographies.length === 0 && (isFollowUp(current) || /\b(first|second|third|fourth|last|former|latter)\b/.test(normalize(current)))) {
      const ordinal = resolveOrdinal(current);
      if (ordinal !== void 0) {
        const prior = priorGeographies(messages);
        const picked = ordinal === -1 ? prior[prior.length - 1] : prior[ordinal];
        if (picked) geographies = [picked];
      } else if (/\b(both|them|they|their|the two|these|those|all of them|all three|all four)\b/i.test(current)) {
        geographies = priorGeographies(messages);
      } else {
        const inherited = priorGeography(messages);
        if (inherited) geographies = [inherited];
      }
    }
    if (/\b(higher|lower|greater|less|more|bigger|smaller|larger) than\b|\bcompared? (to|with)\b|\b(versus|vs\.?)\b/i.test(
      current
    )) {
      const concrete = geographies.filter((geo) => geo.name !== "*");
      const prior = priorGeography(messages);
      if (concrete.length === 1 && prior && prior.name.toLowerCase() !== concrete[0].name.toLowerCase()) {
        operation = "compare";
        geographies = [prior, concrete[0]];
      }
    }
    if (operation === "rank_top" || operation === "rank_bottom") {
      const ranked = geographies[0];
      if (ranked?.level === "place") {
        return {
          clarification: "I can rank states, or counties within a state, but not cities. Try 'most populous states' or 'largest counties in Texas'."
        };
      }
      if (ranked?.level === "county" && !ranked.state) {
        return {
          clarification: "Which state's counties should I rank? For example: 'largest counties in Texas'."
        };
      }
    }
    if (operation === "compare") {
      const concrete = geographies.filter((geo) => geo.name !== "*");
      if (concrete.length === 1) {
        operation = "value";
      } else if (concrete.length < 1) {
        return {
          clarification: "Which locations should I compare? For example: 'Compare California and Texas'."
        };
      }
    }
    if (geographies.length === 0 && operation === "value") {
      return {
        clarification: "Which US geography should I look up? I can answer for the whole US, a state, a county (with its state), or a city/place (with its state). I don't have regions, ZIP codes, or neighborhoods."
      };
    }
    const hasAmbiguousCounty = geographies.some((geo) => geo.level === "county" && !geo.state);
    if (hasAmbiguousCounty) {
      return {
        clarification: "Please include the state for that county so I can resolve the Census geography unambiguously."
      };
    }
    return {
      operation,
      metrics,
      geographies,
      limit,
      year: requestedYear ?? DEFAULT_YEAR,
      notes: notes.length > 0 ? notes : void 0
    };
  }
  function resolveOrdinal(text) {
    const normalized = normalize(text);
    if (/\b(last|latter|most recent)\b/.test(normalized)) return -1;
    if (/\b(first|former)\b/.test(normalized)) return 0;
    if (/\bsecond\b/.test(normalized)) return 1;
    if (/\bthird\b/.test(normalized)) return 2;
    if (/\bfourth\b/.test(normalized)) return 3;
    return void 0;
  }
  function detectYear(text) {
    const match = text.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
    return match ? Number(match[0]) : void 0;
  }
  function mentionsIncome(text) {
    const normalized = normalize(text);
    return /\b(income|earnings|earn|earns|salary|salaries|wage|wages|wealthy|wealth|rich|affluent|how much do (people|they|residents) (make|earn))\b/.test(
      normalized
    ) && !/\b(median|household|per capita|capita)\b/.test(normalized);
  }
  var UNSUPPORTED_CONCEPTS = [
    [/\bgdp\b|\bgross domestic product\b/, "GDP or economic output"],
    [/\b(crime|crimes)\b/, "crime statistics"],
    [/\b(unemployment|employment|employed|jobs|labor force|workforce|occupation)\b/, "employment data"],
    [/\b(housing|houses|homes|home value|home values|rent|rents|mortgage|homeowner|homeowners|homeownership|renter|renters)\b/, "housing data"],
    [/\b(education|school|schools|college|degree|degrees|graduate|graduates|bachelor|literacy|student|students|enrollment)\b/, "educational attainment"],
    [/\b(veteran|veterans|military)\b/, "veteran or military status"],
    [/\b(commute|commuting|commuters|transit|transportation)\b/, "commuting or transportation"],
    [/\b(disability|disabilities|disabled)\b/, "disability data"],
    [/\b(language|languages)\b/, "language spoken at home"],
    [/\b(marriage|married|divorce|divorced|marital)\b/, "marital status"],
    [/\b(birth|births|death|deaths|mortality|fertility)\b/, "vital statistics like births or deaths"],
    [/\b(immigration|immigrant|immigrants|citizenship|naturalized|foreign born|undocumented|refugee|refugees)\b/, "immigration or citizenship"],
    [/\b(insurance|uninsured|healthcare|health coverage)\b/, "health or insurance"],
    [/\b(voter|voters|voting|election|elections)\b/, "voting or elections"],
    // Age-group and subgroup counts we don't break out (only total/sex/race counts).
    [/\b(working|voting|school|retirement|college|legal|fighting|preschool|drinking) age\b/, "age-group breakdowns"],
    [/\bage (group|groups|bracket|brackets|distribution|range|ranges|cohort|cohorts)\b/, "age-group breakdowns"],
    [/\b(child|children|kids|minors|toddlers|infants|teen|teens|teenagers|youth)\b/, "age-group breakdowns (e.g. children)"],
    [/\b(senior|seniors|elderly|elders|retirees|pensioners|geriatric)\b/, "age-group breakdowns (e.g. seniors)"],
    [/\b(homeless|homelessness|incarcerated|prison|prisoners|inmates)\b/, "that subgroup"],
    [/\b(household size|number of households|how many households|households|family size|families)\b/, "household counts"],
    [/\b(urban|rural|suburban) (population|residents|areas?)\b/, "urban/rural breakdowns"],
    [/\b(life expectancy|population density|\bdensity\b|religion|religious)\b/, "that measure"]
  ];
  function unsupportedConcept(text) {
    const normalized = normalize(text);
    for (const [pattern, label] of UNSUPPORTED_CONCEPTS) {
      if (pattern.test(normalized)) return label;
    }
    return void 0;
  }
  function detectMetricKeys(text) {
    return detectMetrics(text);
  }
  function isFollowUp(text) {
    const normalized = normalize(text);
    return /\b(there|that|this|those|these|same|it|again|instead|here|them|they|their|both|the two|all of them|all three|all four)\b/.test(
      normalized
    ) || /^(what about|how about|and|also|what s|whats|ok|okay)\b/.test(normalized);
  }
  function userTurns(messages) {
    return messages.filter((message) => message.role === "user");
  }
  function priorGeography(messages) {
    const users = userTurns(messages);
    for (let i = users.length - 2; i >= 0; i--) {
      const content = users[i].content;
      const geographies = detectGeographies(content, detectOperation(content));
      const concrete = geographies.find(
        (geo) => geo.name !== "*" && !(geo.level === "county" && !geo.state)
      );
      if (concrete) return concrete;
    }
    return void 0;
  }
  function priorGeographies(messages) {
    const users = userTurns(messages);
    for (let i = users.length - 2; i >= 0; i--) {
      const content = users[i].content;
      const concrete = detectGeographies(content, detectOperation(content)).filter(
        (geo) => geo.name !== "*" && !(geo.level === "county" && !geo.state)
      );
      if (concrete.length > 0) return concrete;
    }
    return [];
  }
  var OVERVIEW_RE = /\b(everything|overview|demographics?|all (the )?(stats|statistics|data|metrics|numbers)|full (breakdown|profile|picture)|tell me all)\b/;
  var OVERVIEW_METRICS = [
    "total_population",
    "male_population",
    "female_population",
    "white_population",
    "black_population",
    "asian_population",
    "hispanic_population"
  ];
  function detectMetrics(text) {
    const normalized = normalize(text);
    if (OVERVIEW_RE.test(normalized)) return [...OVERVIEW_METRICS];
    if (/\b(racial|race) (breakdown|composition|makeup|distribution|demographics)\b|\bdivers(e|ity)\b|\bby race\b/.test(normalized)) {
      return ["white_population", "black_population", "asian_population", "hispanic_population"];
    }
    if (/\b(sex|gender) (ratio|breakdown|split|distribution|composition)\b/.test(normalized)) {
      return ["male_population", "female_population"];
    }
    const haystack = ` ${normalized} `;
    const matches = Object.entries(METRICS).filter(([, metric]) => metric.aliases.some((alias) => haystack.includes(` ${normalize(alias)} `))).map(([key]) => key);
    const unique = [...new Set(matches)];
    const populationSubtypes = [
      "male_population",
      "female_population",
      "white_population",
      "black_population",
      "asian_population",
      "hispanic_population"
    ];
    const hasSubtype = unique.some((metric) => populationSubtypes.includes(metric));
    if (unique.length > 1 && unique.includes("total_population") && hasSubtype && !haystack.includes(" total population ")) {
      return unique.filter((metric) => metric !== "total_population");
    }
    return unique;
  }
  function detectOperation(text) {
    const normalized = normalize(text);
    if (/\b(lowest|smallest|bottom|least|fewest)\b/.test(normalized)) return "rank_bottom";
    if (/\b(highest|largest|biggest|top|most populous|most people|most population|greatest|rank(ed|ing|ings)?)\b/.test(normalized)) {
      return "rank_top";
    }
    if (/\b(compare|versus|vs|difference between)\b/.test(normalized)) return "compare";
    return "value";
  }
  function detectLimit(text) {
    const match = text.match(/\b(?:top|bottom)\s+(\d{1,2})\b/i) ?? text.match(/\b(\d{1,2})\s+(?:largest|smallest|highest|lowest|biggest|most|least)\b/i) ?? text.match(/\b(\d{1,2})\s+(?:states|counties|places|cities)\b/i);
    if (!match) return 5;
    return Math.min(Math.max(Number(match[1]), 1), 25);
  }
  function detectGeographies(text, operation) {
    const normalized = normalize(text);
    const usPhrase = /\b(united states|usa|nationwide|national|countrywide|whole country|entire country|across the country)\b/i.test(text);
    const uppercaseUS = /\bU\.?S\.?A?\.?\b/.test(text);
    if (usPhrase || uppercaseUS) {
      const namedStates = findStatesInText(text).map((state) => ({ level: "state", name: state.name }));
      return [{ level: "us", name: "United States" }, ...namedStates];
    }
    if (/\bdistrict of columbia\b/.test(normalized) || /\bwashington\s*,?\s*d\.?\s*c\.?\b/i.test(text)) {
      return [{ level: "state", name: "District of Columbia" }];
    }
    if (operation === "rank_top" || operation === "rank_bottom") {
      const scopeState = findStatesInText(text)[0]?.name;
      if (/\bcounties|county\b/.test(normalized)) return [{ level: "county", name: "*", state: scopeState }];
      if (/\bcities|places|city|place\b/.test(normalized)) return [{ level: "place", name: "*", state: scopeState }];
      return [{ level: "state", name: "*" }];
    }
    const county = text.match(/\b([A-Za-z .'-]+?)\s+County(?:,\s*([A-Za-z .'-]+))?/i);
    if (county) {
      const countyName = cleanCountyName(county[1]);
      const state = county[2] ? findState(county[2])?.name : findStatesInText(text).at(0)?.name;
      return [{ level: "county", name: titleCase(countyName), state }];
    }
    const place = text.match(/\b(?:city of|in|for|of)\s+([A-Za-z .'-]+?),\s*([A-Za-z .'-]+)\b/i);
    if (place) {
      const state = findState(place[2]);
      if (state && !findState(place[1].trim())) {
        return [{ level: "place", name: titleCase(place[1].trim()), state: state.name }];
      }
    }
    const states = findStatesInText(text);
    if (states.length > 0) {
      if (states.length === 1 && text.toLowerCase().includes(`${states[0].name.toLowerCase()} city`)) {
        return [{ level: "place", name: `${states[0].name} City`, state: states[0].name }];
      }
      return states.map((state) => ({ level: "state", name: state.name }));
    }
    if (/\bnyc\b/i.test(text)) return [{ level: "place", name: "New York City", state: "New York" }];
    return [];
  }
  function titleCase(value) {
    return value.toLowerCase().replace(/\b[a-z]/g, (char) => char.toUpperCase()).replace(/\bDc\b/g, "DC");
  }
  function cleanCountyName(value) {
    return value.split(/\b(?:of|in|for|about|compare|versus|vs)\b/i).at(-1)?.replace(/\b(?:population|people|residents|median|income|poverty|rate|what|is|the)\b/gi, " ").replace(/\s+/g, " ").trim() || value.trim();
  }

  // src/lib/context.ts
  var DEFAULT_MAX_TURNS = 12;
  var DEFAULT_MAX_CHARS = 8e3;
  function compactMessages(messages, opts = {}) {
    const maxTurns = opts.maxTurns ?? DEFAULT_MAX_TURNS;
    const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;
    const totalChars = messages.reduce((sum, message) => sum + message.content.length, 0);
    const approxTokens = Math.ceil(totalChars / 4);
    if (messages.length <= maxTurns && totalChars <= maxChars) {
      return {
        messages,
        compacted: false,
        originalTurns: messages.length,
        keptTurns: messages.length,
        droppedTurns: 0,
        approxTokens
      };
    }
    const latest = messages[messages.length - 1];
    const recent = [];
    let budget = maxChars - latest.content.length;
    for (let i = messages.length - 2; i >= 0 && recent.length < maxTurns - 1; i--) {
      const message = messages[i];
      if (budget - message.content.length < 0) break;
      budget -= message.content.length;
      recent.unshift(message);
    }
    const kept = /* @__PURE__ */ new Set([...recent, latest]);
    const dropped = messages.filter((message) => !kept.has(message));
    const carry = extractCarry(dropped);
    const compactedMessages = [];
    if (carry.metric || carry.geography) {
      const parts = [];
      if (carry.metric) parts.push(carry.metric);
      if (carry.geography) parts.push(`for ${carry.geography}`);
      compactedMessages.push({
        role: "user",
        content: `[earlier conversation summary] Prior focus: ${parts.join(" ")}. Older turns were trimmed to stay within the context budget.`
      });
    }
    compactedMessages.push(...recent, latest);
    return {
      messages: compactedMessages,
      compacted: true,
      originalTurns: messages.length,
      keptTurns: compactedMessages.length,
      droppedTurns: dropped.length,
      approxTokens,
      carry: carry.metric || carry.geography ? carry : void 0
    };
  }
  function extractCarry(history) {
    let metric;
    let geography;
    for (const message of history) {
      const metricKeys = detectMetricKeys(message.content);
      if (metricKeys.length > 0) metric = METRICS[metricKeys[metricKeys.length - 1]].label;
      const states = findStatesInText(message.content);
      if (states.length > 0) geography = states[states.length - 1].name;
    }
    return { metric, geography };
  }

  // web/main.ts
  var FIXTURE = {
    "us:united states": { total_population: 333287557, male_population: 165021339, female_population: 168266218, median_age: 38.9, median_household_income: 74755, per_capita_income: 41104, poverty_rate: 12.5, white_population: 204277273, black_population: 41078951, asian_population: 19886228, hispanic_population: 63664273 },
    "state:california": { total_population: 39029342, male_population: 19434708, female_population: 19594634, median_age: 37.3, median_household_income: 91551, per_capita_income: 46661, poverty_rate: 12.2, white_population: 16160485, black_population: 2176594, asian_population: 6172319, hispanic_population: 15683121 },
    "state:texas": { total_population: 30029572, male_population: 14982114, female_population: 15047458, median_age: 35.5, median_household_income: 72584, per_capita_income: 37514, poverty_rate: 14, white_population: 14817023, black_population: 3694669, asian_population: 1656441, hispanic_population: 12068166 },
    "state:florida": { total_population: 22244823, male_population: 10934571, female_population: 11310252, median_age: 42.7, median_household_income: 67474, per_capita_income: 39218, poverty_rate: 12.7, white_population: 14067427, black_population: 3531056, asian_population: 679451, hispanic_population: 6007296 },
    "state:new york": { total_population: 19677151, male_population: 9586822, female_population: 10090329, median_age: 39.8, median_household_income: 79291, per_capita_income: 47437, poverty_rate: 13.9, white_population: 12130422, black_population: 2816840, asian_population: 1752235, hispanic_population: 3771720 }
  };
  var SAMPLE_NOTE = "This is the static public demo: it runs the real agent logic (guardrails, planner, context) against a census sample for the US and California, Texas, Florida, and New York. The full app (private repo) covers all geographies via Snowflake/Census API with LLM-based NLP.";
  function askCensus(messages) {
    const latest = messages.at(-1)?.content?.trim();
    if (!latest) {
      return { answer: "Ask a US Census population or demographic question to get started.", guardrail: "needs_clarification", outcome: "clarification" };
    }
    const guardrail = checkGuardrails(latest);
    if (!guardrail.allowed) {
      const outcome = guardrail.reason === "unsafe" ? "refused_unsafe" : guardrail.reason === "prompt_injection" ? "refused_prompt_injection" : "refused_off_topic";
      return { answer: guardrail.message ?? "I can only answer US Census population and demographic questions.", guardrail: guardrail.reason ?? "off_topic", outcome };
    }
    const plan = planQuery(compactMessages(messages).messages);
    if ("clarification" in plan) {
      return { answer: plan.clarification, guardrail: "needs_clarification", outcome: "clarification" };
    }
    const result = runFixture(plan);
    if (!result || result.rows.length === 0) {
      return {
        answer: "I don't have that one in the static sample (this demo covers the US and California, Texas, Florida, and New York). The full app answers all states, counties, and rankings. " + SAMPLE_NOTE,
        guardrail: "data_unavailable",
        outcome: "data_unavailable"
      };
    }
    return { answer: narrate(plan, result), guardrail: null, outcome: "answered" };
  }
  function runFixture(plan) {
    const rows = [];
    if (plan.operation === "rank_top" || plan.operation === "rank_bottom") {
      const level = plan.geographies[0]?.level ?? "state";
      if (level !== "state") return { plan, rows: [], warnings: [], source: { name: "Bundled census sample" } };
      const metric = plan.metrics[0];
      const states = Object.entries(FIXTURE).filter(([key]) => key.startsWith("state:")).map(([key, values]) => fixtureRow(key, values, plan.metrics)).filter((row) => row.data[0]?.value !== null).sort((a, b) => {
        const av = a.data.find((d) => d.metric === metric)?.value ?? 0;
        const bv = b.data.find((d) => d.metric === metric)?.value ?? 0;
        return plan.operation === "rank_bottom" ? av - bv : bv - av;
      }).slice(0, plan.limit ?? 5);
      return finalize(plan, states, states.length < (plan.limit ?? 5) ? [`Only ${states.length} sample states are available; the full app ranks all 50.`] : []);
    }
    const requested = plan.geographies.filter((geo) => geo.name !== "*");
    for (const geo of requested) {
      const key = `${geo.level}:${geo.name.toLowerCase()}`;
      const values = FIXTURE[key];
      if (values) rows.push(fixtureRow(key, values, plan.metrics));
    }
    if (rows.length === 0) return { plan, rows: [], warnings: [], source: { name: "Bundled census sample" } };
    const warnings = [];
    if (requested.length > rows.length) {
      warnings.push(`Returned ${rows.length} of ${requested.length} requested locations (the static sample is limited to US/CA/TX/FL/NY).`);
    }
    return finalize(plan, rows, warnings);
  }
  function finalize(plan, rows, warnings) {
    return { plan, rows, warnings, source: { name: "Bundled census sample (US + CA/TX/FL/NY)" } };
  }
  function fixtureRow(key, values, metrics) {
    const [, name] = key.split(":");
    return {
      geography: { level: "state", name: name === "united states" ? "United States" : titleCase2(name) },
      data: metrics.map((metric) => ({ metric, label: METRICS[metric].label, unit: METRICS[metric].unit, value: values[metric] }))
    };
  }
  function narrate(plan, result) {
    const lines = result.rows.map((row) => {
      const facts = row.data.map((point) => `${point.label}: ${formatValue(point.value, point.unit)}`).join("; ");
      return `${row.geography.name}: ${facts}.`;
    });
    const warning = result.warnings.length > 0 ? `

Note: ${result.warnings.join(" ")}` : "";
    return `${lines.join("\n")}${warning}

Source: ${result.source.name}.`;
  }
  function titleCase2(value) {
    return value.replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }
  window.askCensus = askCensus;
})();
