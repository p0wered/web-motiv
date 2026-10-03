// Требования к паролю (PLAN.md §7.1): длина важнее состава. Никаких «заглавная + цифра +
// символ» — только длина и отсев очевидно слабых паролей. Проверка одна для сервера (там она
// обязательна) и для формы (подсказка до отправки).

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 200;

/** Распространённые пароли от 12 символов (короче — отсеиваются по длине). */
const COMMON_PASSWORDS = new Set([
  '123456789012',
  '1234567890123',
  '12345678901234',
  '123123123123',
  '111111111111',
  '000000000000',
  '123456123456',
  '123qweasdzxc',
  '1q2w3e4r5t6y',
  '1q2w3e4r5t6y7u',
  'q1w2e3r4t5y6',
  '1qaz2wsx3edc',
  '1qazxsw23edc',
  'zaq12wsxcde3',
  'qazwsxedcrfv',
  'qwertyqwerty',
  'qwerty123456',
  'qwertyuiop12',
  'qwertyuiop123',
  'asdfghjkl123',
  'zxcvbnm12345',
  'password1234',
  'password123!',
  'passwordpassword',
  'iloveyou1234',
  'abc123456789',
  'abcd12345678',
  'aa1234567890',
  'adminadmin12',
  'administrator',
  'administrator1',
  'welcome12345',
  'letmein12345',
  'princess1234',
  'superman1234',
  'trustno1trustno1',
  'ytrewq654321',
  'йцукен123456',
  'пароль123456',
]);

/** Распространённые слова, которые часто «усиливают» цифрами и символами: Password2026!. */
const COMMON_WORDS = [
  'password',
  'passwort',
  'пароль',
  'gfhjkm', // «пароль» в английской раскладке
  'qwerty',
  'йцукен',
  'admin',
  'administrator',
  'welcome',
  'letmein',
  'iloveyou',
  'changeme',
  'webmotiv',
  'webpricer',
  'motiv',
  'мотив',
];

/** Ряды клавиатуры и алфавиты: пароль, целиком взятый из такого ряда, — не пароль. */
const SEQUENCES = [
  '012345678901234567890123456789',
  'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz',
  'абвгдеёжзийклмнопрстуфхцчшщъыьэюяабвгдеёжзийклмнопрстуфхцчшщъыьэюя',
  'qwertyuiopasdfghjklzxcvbnm',
  "qwertyuiop[]asdfghjkl;'zxcvbnm,./",
  'йцукенгшщзхъфывапролджэячсмитьбю',
  '1234567890-=qwertyuiop',
  '1qaz2wsx3edc4rfv5tgb6yhn7ujm8ik9ol0p',
];

/** Заменяет «хакерские» подмены букв, чтобы P@ssw0rd узнавался как password. */
const LEET: Record<string, string> = {
  '@': 'a',
  $: 's',
  '!': 'i',
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
};

function isFromSequence(value: string): boolean {
  const reversed = [...value].reverse().join('');
  return SEQUENCES.some((sequence) => sequence.includes(value) || sequence.includes(reversed));
}

/** Слово из списка плюс немного «украшений» (цифры, символы, пара букв) — слабый пароль. */
function isDecoratedCommonWord(value: string): boolean {
  const letters = [...value]
    .map((char) => LEET[char] ?? char)
    .join('')
    .replace(/[^a-zа-яё]/g, '');
  return COMMON_WORDS.some((word) => letters.startsWith(word) && letters.length - word.length <= 3);
}

export interface PasswordContext {
  /** Логин сотрудника: пароль не должен его содержать. */
  login?: string | undefined;
}

/** Что не так с паролем — текст для пользователя; `null` — пароль подходит. */
export function passwordProblem(password: string, context: PasswordContext = {}): string | null {
  const length = [...password].length;
  if (length < PASSWORD_MIN_LENGTH) {
    return `Не короче ${PASSWORD_MIN_LENGTH} символов (сейчас ${length})`;
  }
  if (length > PASSWORD_MAX_LENGTH) return `Не длиннее ${PASSWORD_MAX_LENGTH} символов`;

  const normalized = password.toLocaleLowerCase('ru').replace(/\s+/g, '');
  const login = context.login?.trim().toLocaleLowerCase('ru') ?? '';
  if (login.length >= 3 && normalized.includes(login)) return 'Пароль не должен содержать логин';
  if (COMMON_PASSWORDS.has(normalized)) return 'Этот пароль слишком распространён';
  if (new Set(normalized).size < 4) return 'Слишком простой: мало разных символов';
  if (/^(.{1,6})\1+$/u.test(normalized)) return 'Слишком простой: повторяется один фрагмент';
  if (isFromSequence(normalized)) return 'Слишком простой: символы идут подряд';
  if (isDecoratedCommonWord(normalized)) return 'Слишком простой: распространённое слово';
  return null;
}
