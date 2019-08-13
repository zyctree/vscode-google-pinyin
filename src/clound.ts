import * as http2 from 'http2';
import { window } from 'vscode';
import * as assert from 'assert';


class H2Client {

    h2client?: http2.ClientHttp2Session;

    reset(): http2.ClientHttp2Session {
        let h2client = http2.connect(this.url);
        h2client.setTimeout(1000);
        const add_client_on = (event: string) =>
            h2client.on(event, () => {
                window.showInformationMessage(`${this.url}: ${event}`);
                if (this.h2client === h2client) {
                    this.h2client = undefined;
                }
            });

        add_client_on('error');
        add_client_on('close');
        add_client_on('goaway');
        this.h2client = h2client;
        return h2client;
    }

    constructor(readonly url: string) {
        this.reset();
    }
    async post(path: string): Promise<string | undefined> {
        return new Promise((resolve, reject) => {
            let h2client = this.h2client || this.reset();
            try {
                // window.showInformationMessage(path);
                const req = h2client.request({
                    ':path': path, 'method': 'post'
                });
                req.setEncoding('utf8');

                let data = '';
                req.on('data', (chunk) => { data += chunk; });
                req.on('end', () => {
                    // console.log(`\n${data}`);
                    resolve(data);
                });
                // maybe need to handle more `on`
                const add_req_on = (event: string) => {
                    req.on(event, () => window.showInformationMessage(event));
                };
                req.end();
            } catch {
                if (this.h2client === h2client) {
                    this.h2client = undefined;
                }
                resolve(undefined);
            }
        });
    }
}

export interface SearchResult {
    hanzi: string;
    matchedLength: number;
}


export class CloudPinyin {
    h2client = new H2Client('https://inputtools.google.com');
    async search(pinyin: string, limit: number): Promise<Array<SearchResult> | undefined> {
        if (!pinyin) {
            return [];
        }
        const url = `/request?text=${pinyin}&itc=zh-t-i0-pinyin&num=${limit}&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`;


        const response = await this.h2client.post(url);
        if (!response) {
            return undefined;
        }
        // window.showInformationMessage(response);

        const fn_parse_may_throw = () => {

            // response example 
            // ["SUCCESS"
            // ,[["test"
            //    ,["test","特","特殊","特色","忒","他","特斯","特使","她","特设"]
            //    ,[]
            //    ,{"annotation":["t e s t","te","te shu","te se","te","ta","te si","te shi","ta","te she"]
            //     ,"candidate_type":[0,0,0,0,0,0,0,0,0,0]
            //     ,"lc":["0 0 0 0","16","16 16","16 16","16","16","16 16","16 16","16","16 16"]
            //     ,"matched_length":[4,2,3,3,2,1,3,3,1,3]
            //     }
            //   ]]
            // ]
            // matched_length may be omitted, when all annotation matches the whole pinyin

            const json = JSON.parse(response);
            assert(json[0] === "SUCCESS");

            const hanziList = <Array<string>>json[1][0][1];
            const matchedLengthList = <Array<number> | undefined>json[1][0][3]["matched_length"];
            if (!matchedLengthList) {
                return hanziList.map((hanzi: string) =>
                    ({ hanzi, matchedLength: pinyin.length })
                );
            }
            assert(hanziList.length === matchedLengthList.length);

            return hanziList.map((hanzi: string, i: number) =>
                ({ hanzi, matchedLength: matchedLengthList[i] })
            );
        };
        try {
            return fn_parse_may_throw();
        } catch (e) {
            window.showInformationMessage(`parse error on ${response}`);
            return undefined;
        }
    }
}

