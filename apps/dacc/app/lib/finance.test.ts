import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSiteTools} from './site-tools';
import {applyChange, type Receipt} from './data-store';
import {blankCompany, createBackup, createProfileBackup, parseBackup, validateDatabase, type Database} from './data-model';
import {recordVersion} from './record-version';

const profile = {id:'p', name:'Profile', company:blankCompany(), language:'en' as const, showLogo:false};
const expense = {supplier:'Supplier', reference:'001', date:'2026-01-31', currency:'EUR', amount:24.2,
    netAmount:20, vatAmount:4.2, description:'Service', category:'Software', paymentStatus:'unknown',
    sourceDocuments:['receipt.pdf'], notes:'Source values preserved.'};
const invoice = {invoiceNumber:'001', created:'2026-01-01', due:'2026-02-01', quantity:1, rate:100,
    paid:false, description:'Service', companyToBill:blankCompany()};
function fixture() {
    let data: Database = {profiles:[profile,{...profile,id:'other'}],invoices:[],activeProfileId:'p'};
    let receipts:Record<string,Receipt> = {};
    const tools=createSiteTools({context:()=>({ready:true,activeProfileId:null,selectedInvoiceId:null,invoiceDirty:false,profileDirty:false,editingProfileId:null,busy:false}),mutate:a=>a()},new Map(),{
        readDatabase:async()=>structuredClone(data),
        changeRecords:async(change,request)=>{const next=structuredClone(data), nextReceipts=structuredClone(receipts);const result=applyChange(next,change,nextReceipts,request);data=next;receipts=nextReceipts;return result;}
    });
    const call=async(name:string,args:unknown)=>await tools.find(t=>t.name==='dacc_'+name)!.execute(args) as any;
    return {call,read:()=>structuredClone(data)};
}
test('expenses are idempotent, duplicate safe, versioned and separate from invoices',async()=>{
    const {call,read}=fixture();const args={profileId:'p',requestId:'create',expense};
    const first=await call('create_expense',args);assert.equal(first.ok,true);
    assert.deepEqual(await call('create_expense',args),first);
    assert.equal((await call('create_expense',{...args,requestId:'duplicate'})).error.code,'DUPLICATE_EXPENSE');
    assert.equal(read().invoices.length,0);assert.equal(read().expenses!.length,1);
    const update={profileId:'p',expenseId:first.data.expense.id,expectedVersion:first.data.version,expense:{...expense,amount:30}};
    assert.equal((await call('update_expense',{...update,profileId:'other'})).error.code,'NOT_FOUND');
    assert.equal((await call('update_expense',update)).ok,true);
    assert.equal((await call('update_expense',update)).error.code,'STALE_VERSION');
});
test('invalid expenses fail atomically and cannot change ownership',async()=>{
    const {call,read}=fixture();
    for (const patch of [{date:'2026-02-30'},{currency:'JPY'},{amount:Infinity},{supplier:''},{id:'override'}]) {
        assert.equal((await call('create_expense',{profileId:'p',requestId:'bad',expense:{...expense,...patch}})).ok,false);
    }
    assert.equal(read().expenses,undefined);
});
test('invoice and expense totals group currencies, excluding unknown amounts from outstanding',async()=>{
    const {call}=fixture();
    for(const [currency,paymentStatus] of [['USD','unknown'],['EUR','confirmed']] as const) {
        assert.equal((await call('create_invoice',{profileId:'p',requestId:currency,invoice:{...invoice,invoiceNumber:currency,currency,paymentStatus}})).ok,true);
        assert.equal((await call('create_expense',{profileId:'p',requestId:'e'+currency,expense:{...expense,reference:currency,currency,taxReporting:{currency:'EUR',amount:999,source:'ledger.xlsx'}}})).ok,true);
    }
    const sales=(await call('summarize_invoices',{profileId:'p'})).data;
    assert.equal(sales.total,undefined);assert.equal(sales.count,2);
    assert.equal(sales.totals.find((t:any)=>t.currency==='USD').outstanding,'0.00');
    assert.equal(sales.totals.find((t:any)=>t.currency==='EUR').outstanding,'100.00');
    const costs=(await call('summarize_expenses',{profileId:'p'})).data;
    assert.equal(costs.count,2);assert.deepEqual(costs.totals.map((t:any)=>t.total),['24.20','24.20']);
});
test('backups round trip expenses, currency and evidence, filtering by profile',async()=>{
    const {call,read}=fixture();
    await call('create_expense',{profileId:'p',requestId:'a',expense});
    await call('create_expense',{profileId:'other',requestId:'b',expense});
    await call('create_invoice',{profileId:'p',requestId:'i',invoice:{...invoice,currency:'EUR',notes:'Original',sourceDocuments:['invoice.pdf']}});
    const backup=createBackup(read());assert.equal(JSON.parse(backup).version,3);
    assert.deepEqual(parseBackup(backup),read());
    const single=parseBackup(createProfileBackup(read(),'p'));assert.equal(single.expenses!.length,1);
    assert.equal(single.invoices[0].currency,'EUR');assert.equal(single.invoices[0].notes,'Original');
    assert.throws(()=>validateDatabase({...read(),expenses:[{...read().expenses![0],profileId:'missing'}]}));
});
test('expense changes invalidate profile deletion previews and empty-only deletion is protected',async()=>{
    const {call,read}=fixture();
    const preview=(await call('preview_profile_deletion',{profileId:'p'})).data;
    const created=await call('create_expense',{profileId:'p',requestId:'a',expense});
    const args={profileId:'p',requestId:'delete',expectedVersion:preview.version,emptyOnly:true};
    assert.equal((await call('delete_profile',args)).error.code,'STALE_VERSION');
    const next=(await call('preview_profile_deletion',{profileId:'p'})).data;
    assert.equal(next.expenseCount,1);assert.equal(next.empty,false);
    assert.equal((await call('delete_profile',{...args,expectedVersion:next.version})).error.code,'PROFILE_NOT_EMPTY');
    assert.equal((await call('delete_profile',{...args,expectedVersion:next.version,emptyOnly:false})).ok,true);
    assert.equal(read().expenses!.length,0);assert.equal(read().profiles.length,1);
});
