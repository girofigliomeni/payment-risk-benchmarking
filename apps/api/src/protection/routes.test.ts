import { createServer } from 'node:http';
import { expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { PaymentError } from '../paypal/provider.js';
import { credentialHash, integrationPrincipal, protectionStore, SupabaseProtectionStore } from './store.js';
import type { ProtectionStore } from './store.js';

const owner='11111111-1111-4111-8111-111111111111', session='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const integration='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const credential=`${integration}.${'s'.repeat(43)}`;
const user={id:owner,email:'fictional@example.test',is_anonymous:false};
const token=(claims: Record<string,unknown>={})=>`header.${Buffer.from(JSON.stringify({sub:owner,session_id:session,amr:[{method:'password',timestamp:1}],...claims})).toString('base64url')}.signature`;
const envelope={status:200,requestId:session,serverTime:1000,data:{enrolled:true}};
async function withApi(store: ProtectionStore | undefined, test:(send:(path:string,body?:unknown,headers?:Record<string,string>)=>Promise<Response>)=>Promise<void>) {
  const server=createServer(createApp(undefined,undefined,store));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const address=server.address(); if (!address||typeof address==='string') throw new Error('address required');
    await test((path,body,headers={})=>fetch(`http://127.0.0.1:${address.port}${path}`,{
      method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer consumer-token','Content-Type':'application/json','Idempotency-Key':'test-key',...headers},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),
    }));
  } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
}
const mockStore=()=>({consumer:vi.fn().mockResolvedValue({owner,session}),command:vi.fn().mockResolvedValue(envelope)});
it('requires configured authority and explicit bearer auth, never cookies alone',async()=>{
  expect(protectionStore({})).toBeUndefined();
  await withApi(undefined,async send=>expect((await send('/v1/me/protection?source=synthetic')).status).toBe(503));
  const store=mockStore();
  await withApi(store,async send=>{
    expect((await send('/v1/me/protection?source=synthetic',undefined,{Authorization:'',Cookie:'sandbox_session=existing'})).status).toBe(401);
    expect((await send('/v1/me/protection?source=synthetic',undefined,{Origin:'https://untrusted.test'})).status).toBe(403);
  });
  expect(store.command).not.toHaveBeenCalled();
});
it('derives subject from verified bearer, validates strict payloads and requires mutation keys',async()=>{
  const store=mockStore();
  const body={source:'synthetic',purpose:'protection',termsVersion:'protection-terms-v1',accept:true,expectedConsentVersion:0,caps:{dayMinor:0,weekMinor:100}};
  await withApi(store,async send=>{
    expect((await send('/v1/me/consents',body)).status).toBe(200);
    expect(store.command).toHaveBeenLastCalledWith({owner,session},'synthetic','consent','test-key',body);
    for(const invalid of [{...body,ownerId:owner},{...body,acceptedAt:0},{...body,termsVersion:'ai-analysis-terms-v1'},
      {...body,caps:{dayMinor:0.5,weekMinor:10}},{...body,caps:{dayMinor:Number.MAX_SAFE_INTEGER+1,weekMinor:1}},
      {...body,purpose:'unknown'},{...body,source:'real_world'}]) {
      expect((await send('/v1/me/consents',invalid)).status).toBe(400);
    }
    expect((await send('/v1/me/consents',body,{'Idempotency-Key':''})).status).toBe(400);
    expect((await send('/v1/me/consents',{...body,padding:'x'.repeat(17000)})).status).toBe(413);
  });
  expect(store.command).toHaveBeenCalledTimes(1);
});
it('dispatches policy, cooling, cancellation and owned lifecycle reads with bounded strict cursors',async()=>{
  const store=mockStore();
  await withApi(store,async send=>{
    expect((await send('/v1/me/policy-changes',{source:'synthetic',expectedVersion:1,caps:{dayMinor:50,weekMinor:300}})).status).toBe(200);
    expect((await send('/v1/me/cooling-off',{source:'synthetic',expectedVersion:2,days:7})).status).toBe(200);
    expect((await send('/v1/me/cooling-off',{source:'synthetic',expectedVersion:2,days:2})).status).toBe(400);
    expect((await send(`/v1/me/policy-changes/${session}/cancel`,{source:'synthetic',expectedVersion:3})).status).toBe(200);
    expect(store.command).toHaveBeenLastCalledWith({owner,session},'synthetic','cancel','test-key',{source:'synthetic',expectedVersion:3,id:session});
    expect((await send('/v1/me/protection/history?source=synthetic&pageSize=101')).status).toBe(400);
    expect((await send('/v1/me/protection/history?source=synthetic&ownerId='+owner)).status).toBe(400);
    expect((await send('/v1/me/protection/history?source=synthetic&after=10&pageSize=10')).status).toBe(200);
    expect((await send(`/v1/me/export-requests/${session}?source=synthetic&section=consents&after=1`)).status).toBe(200);
    expect((await send(`/v1/me/export-requests/bad?source=synthetic`)).status).toBe(400);
  });
});
it('keeps integration credentials out of consumer methods and invitation owner fields out of integrator input',async()=>{
  const store=mockStore();
  await withApi(store,async send=>{
    expect((await send('/v1/integrations/link-invitations',{externalReference:'fictional-ref'},{Authorization:`Bearer ${credential}`})).status).toBe(200);
    expect(store.consumer).not.toHaveBeenCalled();
    expect(store.command).toHaveBeenLastCalledWith({integration,credentialHash:credentialHash(credential)},null,'invite','test-key',{externalReference:'fictional-ref'});
    expect((await send('/v1/integrations/link-invitations',{externalReference:'ref',ownerId:owner},{Authorization:`Bearer ${credential}`})).status).toBe(400);
    expect((await send('/v1/integrations/links',undefined,{Authorization:'Bearer invalid'})).status).toBe(401);
    expect((await send('/v1/me/integration-links',{source:'synthetic',invitationId:session})).status).toBe(200);
  });
  expect(integrationPrincipal(credential)).toEqual({integration,credentialHash:credentialHash(credential)});
  expect(()=>integrationPrincipal(`${credential}.extra`)).toThrow();
});
it('supports only approved browser origin and idempotency CORS header on v1',async()=>{
  const server=createServer(createApp());
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const address=server.address(); if(!address||typeof address==='string') throw new Error('address required');
    const response=await fetch(`http://127.0.0.1:${address.port}/v1/me/consents`,{method:'OPTIONS',headers:{Origin:'http://127.0.0.1:5173','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type,idempotency-key'}});
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Idempotency-Key');
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
it('verifies the exact token before decoding session identity and never uses iat as auth time',async()=>{
  const request=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(user)));
  const store=new SupabaseProtectionStore('https://example.test','server-key',request);
  const refreshed=token({iat:9999999999});
  expect(await store.consumer(refreshed)).toEqual({owner,session});
  expect(request.mock.calls[0]?.[1]?.headers).toMatchObject({Authorization:`Bearer ${refreshed}`});
  for(const invalid of [token({sub:session}),token({session_id:undefined}),token({amr:[{method:'otp',timestamp:1}]}),'malformed']) {
    request.mockResolvedValueOnce(new Response(JSON.stringify(user)));
    await expect(store.consumer(invalid)).rejects.toMatchObject({status:401});
  }
  request.mockResolvedValueOnce(new Response('{}',{status:401}));
  await expect(store.consumer(refreshed)).rejects.toMatchObject({status:401});
});
it('fails closed on Auth/storage outages and redacts upstream errors',async()=>{
  const request=vi.fn<typeof fetch>();
  const store=new SupabaseProtectionStore('https://example.test','server-key',request);
  request.mockRejectedValueOnce(new Error('sensitive upstream payload'));
  await expect(store.consumer(token())).rejects.toMatchObject({status:503,code:'protection_unavailable'});
  request.mockResolvedValueOnce(new Response('{}',{status:500}));
  await expect(store.consumer(token())).rejects.toMatchObject({status:503});
  request.mockResolvedValueOnce(new Response(JSON.stringify({code:'42501',message:'sensitive database payload'}),{status:403}));
  await expect(store.command({owner,session},'synthetic','read',null,{})).rejects.toMatchObject({status:503,code:'protection_unavailable'});
  request.mockResolvedValueOnce(new Response(JSON.stringify({status:401,error:'fresh_authentication_required'})));
  await expect(store.command({owner,session},'synthetic','read',null,{})).rejects.toMatchObject({status:401});
  request.mockResolvedValueOnce(new Response(JSON.stringify({status:200})));
  await expect(store.command({owner,session},'synthetic','read',null,{})).rejects.toMatchObject({status:503});
});
it('passes only server-derived session/owner or credential hash to authority and preserves safe errors',async()=>{
  const request=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(envelope)));
  const store=new SupabaseProtectionStore('https://example.test','server-key',request);
  expect(await store.command({owner,session},'synthetic','read',null,{})).toEqual(envelope);
  const init=request.mock.calls[0]?.[1];
  expect(JSON.parse(String(init?.body))).toEqual({p_owner:owner,p_session:session,p_integration:null,p_credential_hash:null,p_source:'synthetic',p_action:'read',p_key:null,p_data:{}});
  const failing=mockStore(); failing.command.mockRejectedValue(new PaymentError(409,'policy_version_conflict'));
  await withApi(failing,async send=>{
    const response=await send('/v1/me/protection?source=synthetic');
    expect(response.status).toBe(409);expect(await response.json()).toEqual({error:'policy_version_conflict'});
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
