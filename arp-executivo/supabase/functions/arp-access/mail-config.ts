export function mailConfig(env:Record<string,string|undefined>) {
 const port=Number(env.SMTP_PORT??'587');
 if(!env.SMTP_HOST||!env.SMTP_USER||!env.SMTP_PASS||!env.SMTP_FROM||![465,587].includes(port))return null;
 if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(env.SMTP_FROM))return null;
 return {host:env.SMTP_HOST,port,secure:port===465,requireTLS:port===587,auth:{user:env.SMTP_USER,pass:env.SMTP_PASS},from:env.SMTP_FROM};
}
