const { execSync } = require('child_process');
try {
  const output = execSync('git status', { encoding: 'utf8' });
  console.log('Git Status:\n', output);
} catch (err) {
  console.error('Git error:', err.message);
  if (err.stdout) console.log('Stdout:', err.stdout.toString());
  if (err.stderr) console.error('Stderr:', err.stderr.toString());
}
