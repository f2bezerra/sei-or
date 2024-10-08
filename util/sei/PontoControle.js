
class PontoControle {
    /** 
     * @type String 
     */
    name;

    /**
     * Link para atualização do Ponto de Controle
     *
     * @type {String}
     */
    link;

    /**
     * Transição a ser executada em caso de confirmação
     *
     * @type {TransicaoPontoControle}
     */
    resolve;

    /**
     *  Transição a ser executada em caso de rejeição
     *
     * @type {TransicaoPontoControle}
     */
    reject;

    constructor(name, link, resolve, reject) {
        this.name = name;
        this.link = link;
        this.resolve = resolve;
        this.reject = reject;
    }

    static fromName(name, link) {
        let config = this.#load();

        let pontoControle;

        if (pontoControle = Object.values(config).find(pc => pc.name == name)) {
            if (pontoControle.resolve && pontoControle.resolve.to && typeof pontoControle.resolve.to == "string") {
                pontoControle.resolve.to = config[pontoControle.resolve.to];
            }

            if (pontoControle.reject && pontoControle.reject.to && typeof pontoControle.reject.to == "string") {
                pontoControle.reject.to = config[pontoControle.reject.to];
            }

            return new PontoControle(pontoControle.name, link, pontoControle.resolve, pontoControle.reject);
        }

        return null;
    }

    static #load() {
        let config;
        $.ajax({ url: browser.runtime.getURL('config/PontoControle.json'), async: false, dataType: 'json', success: response => config = response });
        return config;
    }

    static list() {
        let config = this.#load();
        return Object.values(config);
    }

    async doResolve(source, refresh) {
        return this.#applyTransicaoPontoControle(this.resolve, source, refresh);
    }

    async doReject(source, refresh) {
        return this.#applyTransicaoPontoControle(this.reject, source, refresh);
    }

    async #applyTransicaoPontoControle(transaction, source, refresh) {
        if (!transaction) throw new Error('Transição não definida');

        if (transaction.actions) {
            let fields = [];
            let values = {};
            for (let action of transaction.actions) {
                action = action.match(/^\s*([\w-]+)(\*)?(?::(.+\S))?/);
                if (action[2] || !action[3]) {
                    switch (action[1]) {
                        case 'pgd-a':
                            fields.push({ id: "pgd", label: "Minutos para PGD (Analista)", type: "text", value: action[3] ?? '', validation: /^\s*\+?\d+\s*$/ });
                            break;

                        case 'pgd-v':
                            fields.push({ id: "pgd", label: "Minutos para PGD (Avaliador)", type: "text", value: action[3] ?? '', validation: /^\s*\+?\d+\s*$/ });
                            break;

                        case 'nota':
                            fields.push({ id: "nota", label: "Nota", type: "textarea", rows: 4, value: action[3] ?? '' });
                            break;

                        case 'reatribuir':
                            {
                                let registros = await getHistorico({ descricao: /atribuído/i });

                                if (registros) {
                                    registros.shift();
                                    registros = registros.map(reg => (m = reg.descricao.match(/atribu[ií]do\s+para\s+(\w+)/i)) ? m[1] : '');
                                }

                                if (registros.length) {
                                    registros = [...new Set(registros)];
                                    fields.push({ id: "reatribuir", label: "Devolver para o usuário", type: "select", items: registros, value: registros[0] });
                                }

                            }
                            break;
                    }
                }

                if (action[3]) values[action[1]] = action[3];
            }

            if (fields.length) {
                let title = transaction.desc ?? 'sei-or';
                title = title.split(" ");

                let confirmButton = transaction.desc ? title[0] : 'Confirmar';

                title[0] = title[0].replace(/ar$/, 'ação');
                title = title.join(' ');

                values = await openFormDlg(fields, title, { width: "400px", confirmButton: confirmButton, alwaysResolve: true });

                if (!values) return;
            }

            for (let action of transaction.actions) {
                action = action.match(/[\w-]+/)[0];
                switch (action) {
                    case 'pgd-a':
                        await this.#setPGD('Análise', values.pgd);
                        break;

                    case 'pgd-v':
                        await this.#setPGD('Avaliação', values.pgd);
                        break;

                    case 'pgd-ra':
                        await this.#delPGD('Análise');
                        break;


                    case 'nota':
                        await this.#setNota(values.nota);
                        break;

                    case 'atribuir':
                        await this.#atribuir();
                        break;

                    case 'desatribuir':
                        await this.#desatribuir();
                        break;

                    case 'reatribuir':
                        if (values.reatribuir) await this.#atribuir(values.reatribuir);
                        break;
                }
            }
        }

        await this.#set(transaction.to ? transaction.to.value : "null");

        if (refresh) window.top.document.location.reload();
    }

    async #setPGD(marker, value) {
        if (value && value.match(/^\s*\+\d+\s*$/i)) {
            let intValue = Number(value.replace(/\D/g, ''));
            value = async e => {
                if (e.nota && e.nota.match(/^\s*PGD\s*:\s*\d+/i)) intValue += Number(e.nota.replace(/\D/g, ''));
                return `PGD:${intValue}`;
            };
        } else value = `PGD:${value}`;

        return setMarcador(marker, value);
    }

    async #delPGD(marker) {
        return delMarcador(marker);
    }

    async #setNota(value) {
        return addAnotacao(value);
    }

    async #atribuir(user) {
        return attribProcesso(user);
    }

    async #desatribuir() {
        return attribProcesso(null);
    }

    async #set(value) {
        if (!value) throw new Error("Ponto de Controle inválido");

        if (typeof value == "string" && value != "null") {
            let list = PontoControle.list();

            let pontoControle = list.find(item => item.name == value);
            if (!pontoControle) throw new Error(`Ponto de Controle '${value} 'não encontrado`);
        }

        value = value != "null" ? Number(value) : value;

        if (!this.link) {
            let docArvore = await waitDocumentReady("#ifrArvore");
            var pontoControle = getPontoControleInfo(docArvore);

            this.link = pontoControle.link;
        }

        return postFormData(this.link, { selSituacao: value });
    }

}

/**
 * @typedef {Object} TransicaoPontoControle - Configuração de transição de pontos de controle
 * @property {String} [to] - Ponto de Controle Destino
 * @property {String} desc - Descrição da transição
 * @property {String} [icon] - Ícone representativo da transição
 * @property {Array<String>} [actions] - Ações que serão executadas antes da transição
 *
 */



