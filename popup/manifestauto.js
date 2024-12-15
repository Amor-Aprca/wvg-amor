(function() {
    'use strict';

    // 解析工具类
    class Evaluator {
        static isDASH(text) {
            return text.includes('<mpd') && text.includes('</mpd>');
        }

        static isHLS(text) {
            return text.includes('#extm3u');
        }

        static isHLSMaster(text) {
            return text.includes('#ext-x-stream-inf');
        }

        static isMSS(text) {
            return text.includes('<smoothstreamingmedia') && text.includes('</smoothstreamingmedia>');
        }

        static getManifestType(text) {
            const lower = text.toLowerCase();
            if (this.isDASH(lower)) {
                return "DASH";
            } else if (this.isHLS(lower)) {
                if (this.isHLSMaster(lower)) {
                    return "HLS_MASTER";
                } else {
                    return "HLS_PLAYLIST";
                }
            } else if (this.isMSS(lower)) {
                return "MSS";
            }
            return null;
        }
    }

    // 打印信息的格式化函数
    function logManifest(type, url) {
        console.log("Manifest Detected:");
        console.log("  url: ", url);
        console.log("  type:", type);
    }

    // 拦截 fetch
    const originalFetch = window.fetch;
    window.fetch = function() {
        return new Promise(async (resolve, reject) => {
            originalFetch.apply(this, arguments).then((response) => {
                if (response) {
                    response.clone().text().then((text) => {
                        const manifestType = Evaluator.getManifestType(text);
                        if (manifestType) {
                            logManifest(manifestType, arguments[0]);
                            if (manifestType === "DASH") {
                                window.capturedMPDUrl = arguments[0];
                            }
                        }
                        resolve(response);
                    }).catch(() => {
                        resolve(response);
                    });
                } else {
                    resolve(response);
                }
            }).catch(() => {
                resolve();
            });
        });
    };

    // 拦截 XMLHttpRequest
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        this._method = method;
        this._url = url;
        return open.apply(this, arguments);
    };

    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(postData) {
        this.addEventListener('load', function() {
            if (this._method === "GET") {
                let body = void 0;
                switch (this.responseType) {
                    case "":
                    case "text":
                        body = this.responseText ?? this.response;
                        break;
                    case "arraybuffer":
                        if (this.response.byteLength) {
                            const response = new Uint8Array(this.response);
                            body = String.fromCharCode(...response.slice(0, 2000));
                        }
                        break;
                    case "blob":
                        const reader = new FileReader();
                        reader.onload = () => {
                            body = reader.result;
                        };
                        reader.readAsText(this.response);
                        break;
                }

                if (body) {
                    const manifestType = Evaluator.getManifestType(body);
                    if (manifestType) {
                        logManifest(manifestType, this._url);
                        if (manifestType === "DASH") {
                            window.capturedMPDUrl = this._url;
                        }
                    }
                }
            }
        });

        return send.apply(this, arguments);
    };

})();
