import test from 'node:test';
import assert from 'node:assert/strict';
import {shanghaiDay,shiftDay,daysUntil,countdown,eventModel,loadEvents} from '../public/events.js';
const today='2099-01-01';
const event=(id,day)=>({id,symbol:'09999.HK',title:'虚构事件 '+id,event_date:day,status:'upcoming',importance:'high'});
test('事件倒计时：上海午夜、今天/明天/跨年、日期差不受事件时区影响',()=>{
 assert.equal(shanghaiDay(new Date('2098-12-31T15:59:59Z')),'2098-12-31');assert.equal(shanghaiDay(new Date('2098-12-31T16:00:00Z')),today);
 assert.equal(countdown(today,today),'今天');assert.equal(countdown('2099-01-02',today),'明天');assert.equal(countdown('2099-01-31',today),'还有 30 天');assert.equal(countdown('2098-12-31',today),'已过 1 天');assert.equal(daysUntil('2099-02-01',today),31);
 assert.equal(shiftDay('2096-02-28',1),'2096-02-29');assert.equal(shiftDay(today,-1),'2098-12-31');
});
test('事件默认范围含今日和第30天，按日期与id排序分组，不混入第31天',()=>{
 const data={items:[event('b','2099-01-02'),event('late','2099-02-01'),event('edge','2099-01-31'),event('a',today),event('c','2099-01-02')],recent:[],future:[]};
 const model=eventModel(data,{today,mode:'upcoming',day:'2098-01-01'});assert.deepEqual(model.groups.map(g=>g.day),[today,'2099-01-02','2099-01-31']);assert.deepEqual(model.groups[1].items.map(e=>e.id),['b','c']);
});
test('单日空态与30天外空态都能选最近未来事件，无未来登记时不伪造',()=>{
 const data={items:[],recent:[],future:[event('far','2099-02-02'),event('next','2099-02-01'),event('old','2098-12-31')]};
 const model=eventModel(data,{today,mode:'day',day:'2099-01-03'});assert.equal(model.groups.length,0);assert.equal(model.nearest.id,'next');
 assert.equal(eventModel({...data,future:[]},{today,mode:'upcoming',day:today}).nearest,null);
 assert.equal(eventModel({...data,items:[event('match','2099-01-03'),event('other',today)]},{today,mode:'day',day:'2099-01-03'}).groups[0].items.length,1);
});
test('近7天已过事件按日期判定，原upcoming不改写、输入不变',()=>{
 const data={items:[],future:[],recent:[event('outside','2098-12-24'),event('edge','2098-12-25'),event('past','2098-12-31'),event('now',today)]};const before=JSON.stringify(data);
 assert.deepEqual(eventModel(data,{today,mode:'upcoming',day:today}).recent.map(e=>e.id),['edge','past']);assert.equal(JSON.stringify(data),before);
});
test('事件加载只复用既有from/to接口，空范围才额外查最近未来登记',async()=>{
 const calls=[];const api=async url=>{calls.push(url);return {items:[]};};
 await loadEvents(api,undefined,{today,mode:'upcoming',day:'2098-01-01'});
 assert.deepEqual(calls,['/v1/events?from=2099-01-01&to=2099-01-31','/v1/events?from=2098-12-25&to=2098-12-31','/v1/events?from=2099-01-01']);
 calls.length=0;const model=await loadEvents(async url=>{calls.push(url);return {items:[event('demo','2099-01-03')]};},undefined,{today,mode:'day',day:'2099-01-03'});assert.equal(calls.length,2);assert.equal(calls[0],'/v1/events?from=2099-01-03&to=2099-01-03');assert.deepEqual(model.future,[]);
});
