import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createAuctionModule} from '../modules/auction/index.js';
import {defaultAuction,validateAuction} from '../modules/auction/config.js';

function scratch(){
  const dir=fs.mkdtempSync(path.resolve('tests/scratch-auction-'));
  return {dir,remove(){for(const name of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,name));fs.rmdirSync(dir);}};
}

test('auction validates design fields, duration and custom CSS',()=>{
  const {customCss,style,showTitle,showItem,showTimer,showRanking,showTotal,rgbNames,pulseLeader,...old}=defaultAuction;
  assert.deepEqual(validateAuction(old),defaultAuction);
  const custom={...defaultAuction,style:'spotlight',position:'bottom-left',duration:0,limit:3,showRanking:false,customCss:'.auction-winner { color: red; }'};
  assert.deepEqual(validateAuction(custom),custom);
  assert.throws(()=>validateAuction({...custom,customCss:'.auction-winner {'}));
  assert.throws(()=>validateAuction({...custom,style:'unknown'}));
  assert.throws(()=>validateAuction({...custom,duration:-1}));
  assert.throws(()=>validateAuction({...custom,limit:11}));
  assert.throws(()=>validateAuction({...custom,itemTitle:'   '}));
  assert.throws(()=>validateAuction({...custom,pulseLeader:'true'}));
  assert.throws(()=>validateAuction({...custom,accent:'gold'}));
});

test('auction accepts bids only while live, deduplicates gifts and restores the round after restart',t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:10000});
  const data=scratch();let changes=0;
  const context={dataDir:data.dir,changed(){changes++;},log(){}};
  const module=createAuctionModule(context);
  t.after(()=>{module.close();data.remove();});
  assert.equal(module.state().status,'idle');
  assert.equal(module.receive({userId:'1',user:'Ana',count:5,diamonds:90},'canal'),false,'Bids require an open round');
  module.begin();
  assert.equal(module.state().status,'live');assert.equal(module.state().round,1);
  assert.equal(module.state().itemTitle,defaultAuction.itemTitle);
  assert.equal(module.state().endsAt,130000);
  assert.equal(module.receive({userId:'1',user:'Ana',count:5,diamonds:90,gift:'Rosa',avatar:'https://example.com/ana.jpg',messageId:'a'},'canal'),true);
  assert.equal(module.receive({userId:'2',user:'Luis',count:9,diamonds:45,gift:'León',messageId:'b'},'canal'),true);
  assert.equal(module.receive({userId:'2',user:'Luis',count:9,diamonds:45,messageId:'b'},'canal'),false);
  module.receive({userId:'1',user:'Ana',count:3,diamonds:5,gift:'Corazón',messageId:'c'},'canal');
  assert.equal(module.state().leader.id,'1');assert.equal(module.state().total,140);assert.equal(module.state().totalGifts,17);
  assert.equal(module.state().participants,2);assert.equal(module.state().ranking[1].lastGift,'León');
  assert.equal(module.state().ranking[1].avatar,'','Users without a photo keep an empty avatar');
  t.mock.timers.tick(1000);
  const reopened=createAuctionModule(context);t.after(()=>reopened.close());
  assert.equal(reopened.state().savedAt,11000);
  assert.equal(reopened.state().status,'live');assert.equal(reopened.state().total,140);
  assert.equal(reopened.state().leader.avatar,'https://example.com/ana.jpg');
  reopened.end();
  assert.equal(reopened.state().status,'ended');assert.equal(reopened.state().winner.id,'1');assert.equal(reopened.state().winner.diamonds,95);
  assert.equal(reopened.receive({userId:'3',user:'Eva',count:50,diamonds:900},'canal'),false,'Closed auctions ignore bids');
  assert.equal(reopened.results().users.length,2);
  reopened.next();
  assert.equal(reopened.state().status,'live');assert.equal(reopened.state().round,2);assert.equal(reopened.state().total,0);assert.equal(reopened.state().winner,null);
  reopened.save({...defaultAuction,title:'Mi subasta',itemTitle:'Lote 2',limit:1,duration:0,style:'spotlight'});
  assert.equal(reopened.state().config.title,'Mi subasta');assert.equal(reopened.state().endsAt,0);
  reopened.receive({userId:'4',user:'Eva',count:2,diamonds:300},'otro');
  assert.equal(reopened.state().total,300);assert.equal(reopened.state().channel,'otro');
  reopened.reset();
  assert.equal(reopened.state().status,'idle');assert.equal(reopened.state().round,0);assert.equal(reopened.state().total,0);
  assert.equal(reopened.state().config.title,'Mi subasta');
});

test('auction closes itself when the countdown ends and rejects late bids',t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:5000});
  const data=scratch();
  const module=createAuctionModule({dataDir:data.dir,changed(){},log(){}});
  t.after(()=>{module.close();data.remove();});
  module.save({...defaultAuction,duration:10});
  module.begin();
  module.receive({userId:'1',user:'Ana',count:2,diamonds:500},'canal');
  assert.equal(module.state().remainingMs,10000);
  t.mock.timers.tick(11000);
  assert.equal(module.state().status,'ended');
  assert.equal(module.state().winner.id,'1');
  assert.equal(module.state().remainingMs,0);
  assert.equal(module.receive({userId:'2',user:'Luis',count:1,diamonds:999},'canal'),false);
  module.close();
  const reopened=createAuctionModule({dataDir:data.dir,changed(){},log(){}});
  t.after(()=>reopened.close());
  assert.equal(reopened.state().status,'ended');assert.equal(reopened.state().winner.name,'Ana');
  assert.throws(()=>reopened.end(),/ya está cerrada/);
  reopened.begin();
  assert.equal(reopened.state().status,'live');assert.equal(reopened.state().round,2);
});
