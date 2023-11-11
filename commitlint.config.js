const {
  utils: { getProjects },
} = require('@commitlint/config-nx-scopes');

const customScopes = ['deps', 'deps-dev', 'nx', 'snyk', 'dependabot'];

module.exports = {
  extends: ['@commitlint/config-conventional', '@commitlint/config-nx-scopes'],
  ignores: [
    message =>
      message.startsWith('Merge') ||
      message.startsWith('Revert') ||
      message.startsWith('[Snyk]'),
  ],
  rules: {
    'header-max-length': [0, 'always', 125],
    'footer-max-line-length': [0, 'always', Infinity],
    'body-max-line-length': [0, 'always', Infinity],
    'scope-enum': async ctx => [
      2,
      'always',
      [...customScopes, ...(await getProjects(ctx))],
    ],
  },
};
