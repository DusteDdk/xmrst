#!/usr/bin/node

// Configuration: The wallet address being mined to.
const address = '';
// Ends heres

if(address.length===0) {
	console.error('You need to edit main.js and set the address!');
	process.exit(1);
}
const fs = require('fs');
const B = require('bignumber.js');
const request = require('request');
B.config({
	DECIMAL_PLACES: 50,
	ROUNDING_MODE: 0
});
var tot = "0";
var balance;
const all = {};
const url = 'http://api.minexmr.com:8080/get_wid_stats?address='+address;

request(url, (err, resp, body) => {
	if (err) {
		throw err;
	}

	const data = JSON.parse(body);

	data.forEach((d) => {
		if (d.hashes) {
			const name = d.address.substr(address.length + 1);
			d.name=name;
			tot = new B(tot).plus(d.hashes);
		} else if (d.address === address) {
			balance = new B(d.balance).dividedBy("1E12");
		}
	});

	const js = {};

	const f = balance.dividedBy(tot);
	js.balance = balance;
	js.xmrPrShare = f;

	console.log('\nWallet:' +
		'\n  Address ..: ' + address + 
		'\n  Shares ...: ' + tot +
		'\n  Balance ..: ' + balance+
		'\n  xmr/share : ' + f);

	request('https://api.cryptonator.com/api/ticker/XMR-EUR', (err, resp, body) => {
		const xmreur = JSON.parse(body);
		request('https://api.cryptonator.com/api/ticker/XMR-BTC', (err, resp, body) => {
			const xmrbtc = JSON.parse(body);
			request('http://api.fixer.io/latest?symbols=EUR,DKK', (err, resp, body) => {

				const edk = JSON.parse(body);
				const edkr = new B('' + edk.rates.DKK);
				const xr = new B('' + xmrbtc.ticker.price);
				const xe = new B('' + xmreur.ticker.price);
				console.log('\nExhange Rates:')
				console.log('  XMR>EUR ..: ' + xe);
				console.log('  XMR>BTC ..: ' + xr);
				console.log('  Total EUR : ' + xe.times(balance).toFixed(2) + ' (' + xe.times(balance).times(edkr).toFixed(2) + ' DKK)');
				console.log('  Total BTC : ' + xr.times(balance).toFixed(8));

				js.rates = {
					xmrEur: xe,
					xmrBtc: xr,
					totEur: xe.times(balance),
					totEurDkk: xe.times(balance).times(edkr),
					totBtc: xr.times(balance),
				};

				const dStat = {};

				data.sort( (a,b)=>{
					if(a.name) {
						return a.name > b.name;					
					};
					return(false);
				});

				console.log('\nMiner stats:');
				data.forEach((d) => {
					if(!d.hashes)
					{
						return;
					}
					const dHashes = new B(d.hashes);
					const dXMR = f.times(dHashes);
					const dEUR = xe.times(dXMR);
					const dDKK = dEUR.times(edkr);
					const dBTC = xr.times(dXMR);
					const dPcnt = new B(100).dividedBy(tot).times(dHashes);
					console.log(d.name+'\t'+( (d.name.length <8)?'\t':'' )+'XMR: '+dXMR.toFixed(8)+'\tEUR: '+ dEUR.toFixed(2) + '\tDKK:' + dDKK.toFixed(2)+'\tBTC: '+dBTC.toFixed(8)+'\t%: '+dPcnt.toFixed(2));
					dStat[d.name] = {
						XMR: dXMR,
						EUR: dEUR,
						DKK: dDKK,
						BTC: dBTC,
						hsh: d.hashes,
						pcnt: dPcnt
					};
					js.dStat=dStat;

				});

				const logFile = JSON.parse(fs.readFileSync('./log.json'));
				logFile.push(js);
				js.date = Date.now();
				js.entryNum = logFile.length;

				fs.writeFileSync('./log.json', JSON.stringify(logFile, null, 4), {
					encoding: 'utf8'
				});

			});
		});
	});


});
