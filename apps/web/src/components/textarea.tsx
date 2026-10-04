import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cx } from './ui.tsx';

/** Многострочное поле с плавающей подписью Field — как TextInput, но растёт по содержимому. */
export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className, placeholder = ' ', rows = 2, ...props }, ref) {
  // Пустое поле — ровно h-12, как TextInput: рамка 1 + 21 + строка 20 + 5 + рамка 1.
  // Первая строка стоит там же, где текст в TextInput.
  return (
    <textarea
      ref={ref}
      rows={rows}
      placeholder={placeholder}
      className={cx(
        'peer block w-full resize-none rounded-lg border border-transparent bg-sunken px-3 pt-[21px] pb-[5px] text-sm leading-5 text-fg',
        '[field-sizing:content] min-h-12 transition duration-150 placeholder:text-transparent focus:placeholder:text-subtle',
        'focus:border-accent focus:bg-surface focus:outline-none aria-[invalid=true]:border-danger disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
});
