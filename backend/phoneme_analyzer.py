"""
Phoneme-level speech analysis for Kazakh/Russian speech therapy.

Instead of checking "is Л in transcription", this module:
  1. Converts words to phoneme sequences (Cyrillic → IPA-like symbols)
  2. Aligns actual vs. target using Levenshtein edit-distance traceback
  3. Maps each phoneme operation to a clinical disorder name + severity
  4. Returns structured diagnostics with per-sound feedback
"""
from __future__ import annotations


# ── Grapheme → Phoneme (Cyrillic → IPA-like) ────────────────────────────────
# Each Cyrillic letter maps to one phoneme symbol (multi-char strings are OK,
# they are treated as single phoneme units in alignment).

G2P: dict[str, str] = {
    # Shared consonants
    'б': 'b',   'п': 'p',
    'м': 'm',
    'в': 'v',   'ф': 'f',
    'д': 'd',   'т': 't',
    'н': 'n',
    'з': 'z',   'с': 's',
    'л': 'l',
    'р': 'r',
    'й': 'j',
    'ж': 'ʒ',
    'ш': 'ʃ',   'щ': 'ʃ',   # щ = ʃʲ, simplified
    'ч': 'tʃ',
    'ц': 'ts',
    'г': 'g',   'к': 'k',   'х': 'x',
    # Kazakh-specific consonants
    'қ': 'q',
    'ғ': 'ɣ',
    'ң': 'ŋ',
    'һ': 'h',
    # Vowels (Cyrillic shared)
    'а': 'a',   'я': 'a',   # я → palatalized a, simplified
    'е': 'e',   'э': 'e',   'ё': 'o',
    'и': 'i',   'і': 'i',
    'о': 'o',
    'у': 'u',   'ю': 'u',
    'ы': 'ɯ',
    # Kazakh-specific vowels
    'ä': 'æ',   'ә': 'æ',
    'ö': 'ø',
    'ü': 'y',   'ү': 'y',
    'ұ': 'ʊ',
    # Silent letters
    'ъ': '',    'ь': '',
}

# Reverse map: IPA phoneme → representative Cyrillic letter (for display)
_PH_TO_LETTER: dict[str, str] = {}
for _g, _p in G2P.items():
    if _p and _p not in _PH_TO_LETTER and len(_g) == 1:
        _PH_TO_LETTER[_p] = _g.upper()


# ── Disorder catalogue ───────────────────────────────────────────────────────
# Key: (target_phoneme, actual_phoneme)  — what the child SHOULD say vs. DID say
# Value: (disorder_name, ru_description, severity)  severity ∈ {mild, moderate, severe}

DISORDER_MAP: dict[tuple[str, str], tuple[str, str, str]] = {
    # Ротацизм — disorders of /р/
    ('r', 'l'):  ('Ротацизм',             'Замена Р → Л',                     'mild'),
    ('r', 'j'):  ('Ротацизм',             'Замена Р → Й',                     'moderate'),
    ('r', 'v'):  ('Ротацизм',             'Замена Р → В',                     'moderate'),
    ('r', 'w'):  ('Ротацизм',             'Замена Р → В/У',                   'moderate'),
    ('r', ''):   ('Ротацизм',             'Пропуск звука Р',                  'moderate'),
    # Ламбдацизм — disorders of /л/
    ('l', 'r'):  ('Ламбдацизм',           'Замена Л → Р',                     'mild'),
    ('l', 'j'):  ('Ламбдацизм',           'Замена Л → Й',                     'mild'),
    ('l', 'v'):  ('Ламбдацизм',           'Замена Л → В',                     'mild'),
    ('l', 'u'):  ('Ламбдацизм',           'Замена Л → У (билабиальный)',       'mild'),
    ('l', ''):   ('Ламбдацизм',           'Пропуск звука Л',                  'moderate'),
    # Сигматизм — disorders of sibilants /с ш з ж/
    ('s', 'ʃ'):  ('Сигматизм',            'Замена С → Ш',                     'mild'),
    ('s', 'f'):  ('Сигматизм',            'Замена С → Ф (губно-зубной)',       'moderate'),
    ('s', 'ts'): ('Сигматизм',            'Замена С → Ц',                     'mild'),
    ('s', 'x'):  ('Сигматизм',            'Замена С → Х',                     'moderate'),
    ('s', ''):   ('Сигматизм',            'Пропуск звука С',                  'moderate'),
    ('ʃ', 's'):  ('Сигматизм',            'Замена Ш → С',                     'mild'),
    ('ʃ', 'ʒ'):  ('Сигматизм',            'Замена Ш → Ж (озвончение)',         'mild'),
    ('ʃ', 'x'):  ('Сигматизм',            'Замена Ш → Х',                     'moderate'),
    ('ʃ', ''):   ('Сигматизм',            'Пропуск звука Ш',                  'moderate'),
    ('z', 's'):  ('Сигматизм',            'Замена З → С (оглушение)',          'mild'),
    ('z', ''):   ('Сигматизм',            'Пропуск звука З',                  'moderate'),
    ('ʒ', 'ʃ'):  ('Сигматизм',            'Замена Ж → Ш (оглушение)',         'mild'),
    ('ʒ', ''):   ('Сигматизм',            'Пропуск звука Ж',                  'moderate'),
    # Аффрикатное нарушение — disorders of /ч ц/
    ('tʃ', 's'): ('Аффрикатное нарушение','Замена Ч → С',                     'moderate'),
    ('tʃ', 'ʃ'): ('Аффрикатное нарушение','Замена Ч → Ш',                     'mild'),
    ('tʃ', 't'): ('Аффрикатное нарушение','Замена Ч → Т',                     'moderate'),
    ('tʃ', ''):  ('Аффрикатное нарушение','Пропуск звука Ч',                  'moderate'),
    ('ts', 's'): ('Аффрикатное нарушение','Замена Ц → С',                     'mild'),
    ('ts', 't'): ('Аффрикатное нарушение','Замена Ц → Т',                     'moderate'),
    ('ts', ''):  ('Аффрикатное нарушение','Пропуск звука Ц',                  'moderate'),
    # Казахская специфика — увулярные и фарингальные звуки
    ('q', 'k'):  ('Увулярное нарушение',  'Замена Қ → К',                     'mild'),
    ('q', 'x'):  ('Увулярное нарушение',  'Замена Қ → Х',                     'mild'),
    ('q', 'g'):  ('Увулярное нарушение',  'Замена Қ → Г',                     'moderate'),
    ('q', ''):   ('Увулярное нарушение',  'Пропуск звука Қ',                  'moderate'),
    ('ɣ', 'g'):  ('Увулярное нарушение',  'Замена Ғ → Г',                     'mild'),
    ('ɣ', 'x'):  ('Увулярное нарушение',  'Замена Ғ → Х',                     'mild'),
    ('ɣ', ''):   ('Увулярное нарушение',  'Пропуск звука Ғ',                  'moderate'),
    ('ŋ', 'n'):  ('Назализация',          'Замена Ң → Н',                     'mild'),
    ('ŋ', ''):   ('Назализация',          'Пропуск звука Ң',                  'moderate'),
}

# Phoneme articulatory features — used for "close substitution" fallback
_FEATURES: dict[str, dict] = {
    'r':  {'place': 'alveolar',     'manner': 'trill',       'voiced': True},
    'l':  {'place': 'alveolar',     'manner': 'lateral',     'voiced': True},
    's':  {'place': 'alveolar',     'manner': 'fricative',   'voiced': False},
    'z':  {'place': 'alveolar',     'manner': 'fricative',   'voiced': True},
    'ʃ':  {'place': 'postalveolar', 'manner': 'fricative',   'voiced': False},
    'ʒ':  {'place': 'postalveolar', 'manner': 'fricative',   'voiced': True},
    'tʃ': {'place': 'postalveolar', 'manner': 'affricate',   'voiced': False},
    'ts': {'place': 'alveolar',     'manner': 'affricate',   'voiced': False},
    'k':  {'place': 'velar',        'manner': 'stop',        'voiced': False},
    'g':  {'place': 'velar',        'manner': 'stop',        'voiced': True},
    'q':  {'place': 'uvular',       'manner': 'stop',        'voiced': False},
    'ɣ':  {'place': 'uvular',       'manner': 'fricative',   'voiced': True},
    'ŋ':  {'place': 'velar',        'manner': 'nasal',       'voiced': True},
    'n':  {'place': 'alveolar',     'manner': 'nasal',       'voiced': True},
    'm':  {'place': 'bilabial',     'manner': 'nasal',       'voiced': True},
    'j':  {'place': 'palatal',      'manner': 'approximant', 'voiced': True},
    'x':  {'place': 'velar',        'manner': 'fricative',   'voiced': False},
    'h':  {'place': 'glottal',      'manner': 'fricative',   'voiced': False},
}

# Recommendations per disorder
RECOMMENDATIONS: dict[str, list[str]] = {
    'Ротацизм': [
        'Поднимите кончик языка к альвеолам и сильно дуйте — добейтесь вибрации',
        'Упражнение «Лошадка»: цокайте языком, постепенно переходя к вибрации Р',
        'Тренируйте слоги ДР-ДР-ДР и ТР-ТР-ТР как трамплин к изолированному Р',
    ],
    'Ламбдацизм': [
        'Прижмите широкий язык к верхним альвеолам по бокам, выдыхайте по краям',
        'Упражнение «Индюк»: быстро повторяйте БЛ-БЛ-БЛ',
        'Произносите слоги ЛА–ЛО–ЛУ медленно, контролируя положение языка',
    ],
    'Сигматизм': [
        'При звуке С язык за нижними зубами, при Ш — поднят к нёбу: отработайте разницу',
        'Упражнение «Насос»: длительное СССССС перед зеркалом',
        'Различайте С и Ш на слух: игра «Правильно — неправильно» с логопедом',
    ],
    'Аффрикатное нарушение': [
        'Ч = Т + Ш слитно: тренируйте ТШ-ТШ-ТШ с постепенным ускорением',
        'Контролируйте перед зеркалом округление губ при Ч',
        'Упражнение: шёпотом тянуть Ш, потом резко добавить Т → получится Ч',
    ],
    'Увулярное нарушение': [
        'Қ произносится глубже в горле, чем К: имитируйте «полоскание горла»',
        'Сравнивайте пары КА–ҚА, КОЛ–ҚОЛ перед зеркалом',
        'Упражнение: лечь на спину — в этом положении увулярные звуки появляются проще',
    ],
    'Назализация': [
        'Ң — носовой звук: при нём воздух выходит через нос',
        'Практикуйте медленные переходы Н → НГ → НҢ',
        'Упражнение: пойте «нннн» и плавно переходите к «нгнгнг»',
    ],
}

SEVERITY_META: dict[str, tuple[str, str]] = {
    'mild':     ('Лёгкая',   'Звук слышен, но с незначительным искажением'),
    'moderate': ('Средняя',  'Звук систематически заменяется или пропускается'),
    'severe':   ('Тяжёлая',  'Речь трудно разобрать, требуется интенсивная работа'),
    'none':     ('Норма',    'Произношение соответствует норме'),
}


# ── Core functions ───────────────────────────────────────────────────────────

def word_to_phonemes(word: str) -> list[str]:
    """Convert a Cyrillic word to a list of phoneme symbols."""
    result = []
    for ch in word.lower().strip():
        ph = G2P.get(ch, ch)   # unknown chars kept as-is
        if ph:                  # skip silent letters
            result.append(ph)
    return result


def _levenshtein_align(
    actual: list[str], target: list[str]
) -> list[tuple[str, str, str]]:
    """
    Compute the optimal Levenshtein alignment between two phoneme sequences.

    Returns a list of (operation, actual_ph, target_ph):
      ('equal',      ph,  ph)  — matched
      ('substitute', a,   t)   — child said 'a', should say 't'
      ('delete',     '',  t)   — target sound missing from child's output
      ('insert',     a,   '')  — child added an extra sound
    """
    m, n = len(actual), len(target)

    # Build DP cost table
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if actual[i - 1] == target[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(
                    dp[i - 1][j],       # delete (target missing)
                    dp[i][j - 1],       # insert (extra in actual)
                    dp[i - 1][j - 1],   # substitute
                )

    # Traceback
    ops: list[tuple[str, str, str]] = []
    i, j = m, n
    while i > 0 or j > 0:
        if i > 0 and j > 0 and actual[i - 1] == target[j - 1]:
            ops.append(('equal', actual[i - 1], target[j - 1]))
            i -= 1; j -= 1
        elif i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + 1:
            ops.append(('substitute', actual[i - 1], target[j - 1]))
            i -= 1; j -= 1
        elif j > 0 and (i == 0 or dp[i][j] == dp[i][j - 1] + 1):
            ops.append(('delete', '', target[j - 1]))   # target sound absent
            j -= 1
        else:
            ops.append(('insert', actual[i - 1], ''))   # extra sound
            i -= 1

    ops.reverse()
    return ops


def _get_position(idx: int, total: int) -> str:
    if total <= 1 or idx == 0:
        return 'initial'
    if idx == total - 1:
        return 'final'
    return 'medial'


def _phoneme_to_display(ph: str) -> str:
    return _PH_TO_LETTER.get(ph, ph.upper()) if ph else '∅'


def _classify_error(op: str, actual_ph: str, target_ph: str) -> dict:
    """Map a single phoneme operation to disorder metadata."""
    key = (target_ph, actual_ph)
    if key in DISORDER_MAP:
        disorder, description, severity = DISORDER_MAP[key]
    elif op == 'delete':
        disorder = 'Пропуск звука'
        description = f'Пропуск звука {_phoneme_to_display(target_ph)}'
        severity = 'moderate'
    elif op == 'insert':
        disorder = 'Лишний звук'
        description = f'Лишний звук {_phoneme_to_display(actual_ph)}'
        severity = 'mild'
    else:
        # Generic substitution — check articulatory proximity
        ft = _FEATURES.get(target_ph, {})
        fa = _FEATURES.get(actual_ph, {})
        if ft.get('manner') == fa.get('manner'):
            disorder = 'Близкая замена'
            severity = 'mild'
        else:
            disorder = 'Звуковая замена'
            severity = 'moderate'
        description = (
            f'Замена {_phoneme_to_display(target_ph)} → {_phoneme_to_display(actual_ph)}'
        )

    return {
        'operation': op,
        'target_phoneme': target_ph,
        'actual_phoneme': actual_ph,
        'target_letter': _phoneme_to_display(target_ph),
        'actual_letter': _phoneme_to_display(actual_ph),
        'disorder': disorder,
        'description': description,
        'severity': severity,
    }


# ── Public API ───────────────────────────────────────────────────────────────

def analyze_pronunciation(transcription: str, target_word: str) -> dict:
    """
    Full phoneme-level analysis of one pronunciation attempt.

    Returns:
      accuracy        float 0–100
      detected_errors list[str]   (backward-compatible with existing DB/API)
      phoneme_analysis dict       (new structured diagnostics)
    """
    target_lower = target_word.lower().strip()
    trans_lower  = transcription.lower().strip()

    # ── Empty transcription ──────────────────────────────────────────────────
    if not trans_lower:
        return {
            'accuracy': 0.0,
            'detected_errors': ['Речь не распознана'],
            'phoneme_analysis': {
                'target_phonemes':  word_to_phonemes(target_lower),
                'actual_phonemes':  [],
                'phoneme_errors':   [],
                'disorders_found':  [],
                'overall_severity': 'severe',
                'severity_label':   SEVERITY_META['severe'][0],
                'severity_detail':  SEVERITY_META['severe'][1],
                'recommendations':  ['Попробуйте произнести слово громче и чётче'],
                'edit_distance':    len(word_to_phonemes(target_lower)),
            },
        }

    target_ph = word_to_phonemes(target_lower)
    actual_ph = word_to_phonemes(trans_lower)

    if not target_ph:
        return {
            'accuracy': 100.0,
            'detected_errors': [],
            'phoneme_analysis': {
                'target_phonemes': [], 'actual_phonemes': actual_ph,
                'phoneme_errors': [], 'disorders_found': [],
                'overall_severity': 'none', 'severity_label': 'Норма',
                'severity_detail': SEVERITY_META['none'][1],
                'recommendations': [], 'edit_distance': 0,
            },
        }

    # ── Perfect match shortcut ───────────────────────────────────────────────
    if target_ph == actual_ph:
        return {
            'accuracy': 100.0,
            'detected_errors': [],
            'phoneme_analysis': {
                'target_phonemes': target_ph, 'actual_phonemes': actual_ph,
                'phoneme_errors': [], 'disorders_found': [],
                'overall_severity': 'none', 'severity_label': 'Норма',
                'severity_detail': SEVERITY_META['none'][1],
                'recommendations': [], 'edit_distance': 0,
            },
        }

    # ── Levenshtein alignment ────────────────────────────────────────────────
    alignment = _levenshtein_align(actual_ph, target_ph)

    equal_count   = sum(1 for op, _, _ in alignment if op == 'equal')
    edit_distance = sum(1 for op, _, _ in alignment if op != 'equal')
    denom         = max(len(target_ph), len(actual_ph), 1)
    accuracy      = round(equal_count / denom * 100, 1)

    # ── Classify each non-equal operation ───────────────────────────────────
    phoneme_errors: list[dict] = []
    target_cursor = 0
    for op, a_ph, t_ph in alignment:
        pos = _get_position(target_cursor, len(target_ph))
        if op != 'equal':
            err = _classify_error(op, a_ph, t_ph)
            err['position'] = pos
            phoneme_errors.append(err)
        if op != 'insert':   # 'insert' consumes actual but not target
            target_cursor += 1

    # ── Aggregate by disorder ────────────────────────────────────────────────
    disorders: dict[str, dict] = {}
    for err in phoneme_errors:
        d = err['disorder']
        if d not in disorders:
            disorders[d] = {
                'disorder': d,
                'severity': err['severity'],
                'errors':   [],
                'recommendations': RECOMMENDATIONS.get(d, []),
            }
        # Escalate severity if a worse instance found
        sev_rank = {'mild': 0, 'moderate': 1, 'severe': 2}
        if sev_rank.get(err['severity'], 0) > sev_rank.get(disorders[d]['severity'], 0):
            disorders[d]['severity'] = err['severity']
        if err['description'] not in disorders[d]['errors']:
            disorders[d]['errors'].append(err['description'])

    # ── Overall severity ─────────────────────────────────────────────────────
    all_sev = [e['severity'] for e in phoneme_errors]
    if 'severe' in all_sev:
        overall = 'severe'
    elif 'moderate' in all_sev:
        overall = 'moderate'
    elif all_sev:
        overall = 'mild'
    else:
        overall = 'none'

    # Unique recommendations, preserving order
    seen_recs: set[str] = set()
    recommendations: list[str] = []
    for d in disorders.values():
        for rec in d['recommendations']:
            if rec not in seen_recs:
                seen_recs.add(rec)
                recommendations.append(rec)

    # Backward-compatible detected_errors
    detected_errors: list[str] = list(
        dict.fromkeys(err['description'] for err in phoneme_errors)
    )

    return {
        'accuracy': accuracy,
        'detected_errors': detected_errors,
        'phoneme_analysis': {
            'target_phonemes':  target_ph,
            'actual_phonemes':  actual_ph,
            'phoneme_errors':   phoneme_errors,
            'disorders_found':  list(disorders.values()),
            'overall_severity': overall,
            'severity_label':   SEVERITY_META[overall][0],
            'severity_detail':  SEVERITY_META[overall][1],
            'recommendations':  recommendations,
            'edit_distance':    edit_distance,
        },
    }
