import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cx } from './ui.tsx';

/** Многострочное поле с плавающей подписью Field — как TextInput, но растёт по содержимому. */
export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className, placeholder = ' ', rows = 2, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      placeholder={placeholder}
      className={cx(
        'peer block w-full resize-none rounded-lg border border-transparent bg-sunken px-3 pt-6 pb-2.5 text-sm text-fg',
        '[field-sizing:content] min-h-12 transition duration-150 placeholder:text-transparent focus:placeholder:text-subtle',
        'focus:border-accent focus:bg-surface focus:outline-none aria-[invalid=true]:border-danger disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
});
