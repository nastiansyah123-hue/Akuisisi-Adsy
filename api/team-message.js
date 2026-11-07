import{createTeamMessageHandler}from'../server/team-message.js';
const handle=createTeamMessageHandler();
export default async function handler(req,res){const headers=new Headers();for(const[key,value]of Object.entries(req.headers||{}))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);const request=new Request('https://internal.invalid/api/team-message',{method:req.method,headers});const response=await handle(request,process.env);res.statusCode=response.status;for(const[key,value]of response.headers)res.setHeader(key,value);res.end(await response.text());}
