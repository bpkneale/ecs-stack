
export type StackConfig = {
  account: string;
  region: string;
  env: "dev" | "prd";

  apiRepo: string;
}

const SharedConfig: Pick<StackConfig, "region" | "apiRepo"> = {
  region: 'ap-southeast-2',
  apiRepo: "ecs-stack"
}

const dev: StackConfig = {
  ...SharedConfig,
  account: '531181023012',
  env: "dev"
}

const prd: StackConfig = {
  ...SharedConfig,
  account: '531181023012',
  env: "prd"
}

const Configs = {
  dev,
  prd
}

export function load() {
  const env = process.env.STACK_ENV || 'unknown';

  if (env !== 'dev' && env !== 'prd') {
    throw new Error(`Please specify a valid stack env, got ${env}`)
  }

  return Configs[env];
}
