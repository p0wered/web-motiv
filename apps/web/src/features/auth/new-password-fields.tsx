import { PASSWORD_MIN_LENGTH, passwordProblem } from '@webmotiv/shared';
import { PasswordInput } from '../../components/password-input.tsx';
import { Field } from '../../components/ui.tsx';

interface NewPasswordFieldsProps {
  password: string;
  confirmation: string;
  login: string;
  onPasswordChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
  /** Ошибки от сервера — важнее подсказок на лету. */
  errors: Record<string, string>;
  /** Общая подсказка под полем; требования при вводе показываются в любом случае. */
  showHint?: boolean;
}

export const PASSWORD_HINT = `Не короче ${PASSWORD_MIN_LENGTH} символов. Удобно взять фразу из нескольких слов — заглавные буквы и символы не обязательны.`;

/**
 * Новый пароль и повтор. Требования те же, что на сервере, и проверяются при вводе: пока пароль
 * короче минимума — общая подсказка, дальше — что именно не так. Несовпадение повтора видно,
 * только когда он набран целиком.
 */
export function NewPasswordFields({
  password,
  confirmation,
  login,
  onPasswordChange,
  onConfirmationChange,
  errors,
  showHint = true,
}: NewPasswordFieldsProps) {
  const problem = password ? passwordProblem(password, { login }) : null;
  const mismatch =
    confirmation.length >= password.length && confirmation !== password
      ? 'Пароли не совпадают'
      : undefined;
  return (
    <>
      <Field
        label="Новый пароль"
        error={errors.password}
        hint={
          problem && password.length >= PASSWORD_MIN_LENGTH
            ? problem
            : showHint
              ? PASSWORD_HINT
              : undefined
        }
      >
        {({ id, describedBy, invalid }) => (
          <PasswordInput
            id={id}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            autoComplete="new-password"
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </Field>
      <Field label="Повторите пароль" error={errors.confirmation ?? mismatch}>
        {({ id, describedBy, invalid }) => (
          <PasswordInput
            id={id}
            value={confirmation}
            onChange={(event) => onConfirmationChange(event.target.value)}
            autoComplete="new-password"
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </Field>
    </>
  );
}

/** Можно ли отправлять: пароль подходит и повтор совпадает. */
export function newPasswordReady(password: string, confirmation: string, login: string): boolean {
  return Boolean(password) && !passwordProblem(password, { login }) && password === confirmation;
}
