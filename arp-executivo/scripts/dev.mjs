import { spawn } from 'node:child_process';
// O serviço de pré-visualização injeta opções do Vite; converte apenas a porta.
const args=process.argv.slice(2);
const portIndex=args.indexOf('--port');
const port=portIndex>=0?args[portIndex+1]:process.env.PORT ?? '3000';
const mode=args.includes('--strictPort')?'start':'dev';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next',mode,'--hostname','0.0.0.0','--port',port],{stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code ?? 0));
