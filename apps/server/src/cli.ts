// Командная строка администратора.
//
//   node apps/server/src/cli.ts <команда>
//
// В Docker: `docker compose exec webmotiv webmotiv <команда>` (обёртка запускает CLI от
// пользователя node, чтобы файлы данных не оказались принадлежащими root).

const HELP = `Использование: webmotiv <команда>

Команды:
  help    Показать эту справку
`;

const [command] = process.argv.slice(2);
let exitCode: number;
switch (command) {
  case undefined:
  case 'help':
  case '--help':
    console.log(HELP);
    exitCode = 0;
    break;
  default:
    console.error(`Неизвестная команда: ${command}\n\n${HELP}`);
    exitCode = 1;
}
process.exit(exitCode);
