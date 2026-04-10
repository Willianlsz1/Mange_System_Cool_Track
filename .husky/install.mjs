import process from 'node:process';
import { execSync } from 'node:child_process';

try {
  execSync('git config core.hooksPath .husky', { stdio: 'ignore' });
  execSync('chmod +x .husky/pre-commit', { stdio: 'ignore' });
  process.stdout.write('Git hooks configured at .husky\n');
} catch {
  process.stdout.write('Skipping hook install (git unavailable).\n');
}
