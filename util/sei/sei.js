/**
* @file Funç~eos comuns de interação com o SEI
* @author Fábio Fernandes Bezerra
* @copyright f2bezerra 2024
* @license MIT
*/

/***********************************************/
/* Definição de compatibilidade para o Chrome  */
/***********************************************/
var browser = browser || chrome;


/*******************/
/* Funções Gerais  */
/*******************/

// Retornar informações do ponto de controle de um processo
function getPontoControleInfo(source, onlyName) {
	source = source || getFrameDocument('arvore');
	if (!source) return onlyName ? "" : null;

	let $anchor = $(source).find('a[href*="acao=andamento_situacao"]');

	if (!$anchor.length) return onlyName ? "" : null;

	let name = $anchor.attr("onmouseover");

	if (!name) name = $anchor.find('[title*="Ponto de Controle"]').attr('title');
	name = name && (m = name.match(/(?:['"]|Ponto de Controle\s*\n?\s*)([^'"]+)/i)) ? m[1] : '';

	if (onlyName) return name;

	return { name: name, link: $anchor.attr('href') };
}

//Atribuir processo
async function attribProcesso(user) {
	let docArvore = getFrameDocument("arvore");

	if (!docArvore) throw new Error("Árvore do processo não encontrada");

	if (user === undefined) {
		let infoUser = getCurrentUser();
		user = infoUser.login;
	}


	let urlAtribuir = (m = $(docArvore.head).html().match(/controlador\.php\?acao=procedimento_atribuicao_cadastrar[^'"]+/i)) && m[0].replace(/&amp;/g, "&");

	if (!urlAtribuir) throw new Error("URL de atribuição não encontrada");

	return postFormData(urlAtribuir, e => {
		if (user) {
			let regex = new RegExp(`^${user}`, "i");
			let opt = $(e.html).find('#selAtribuicao option').get().find(item => regex.test($(item).text()));
			if (!opt) return new Error("Usuário não encontrado");
			user = $(opt).val();
		} else user = "null";

		return { selAtribuicao: user };
	});
}

//Retornar documento de frame do SEI
function getFrameDocument(frame) {
	if (!frame) return undefined;

	if (typeof frame == "string") {
		switch (frame) {
			case "ifrArvore":
			case "arvore":
				frame = window.top.document.getElementById("ifrArvore");
				if (!frame && document.getElementById("frmArvore")) return document;
				if (!frame && window.opener) frame = window.opener.top.document.getElementById("ifrArvore");
				break;

			case "ifrVisualizacao":
			case "visualizacao":
			case "visualizador":
				frame = window.top.document.getElementById("ifrVisualizacao");
				if (!frame && window.opener) frame = window.opener.top.document.getElementById("ifrVisualizacao");
				break;

			case "ifrArvoreHtml":
			case "documento":
				frame = window.top.document.getElementById("ifrVisualizacao");
				if (!frame && document.getElementById("divArvoreHtml")) return document;
				if (!frame && window.opener) frame = window.opener.top.document.getElementById("ifrVisualizacao");
				frame = frame && ((frame.contentDocument || frame.contentWindow.document).getElementById("ifrArvoreHtml"));
				break;
		}
	}


	if (frame.tagName != "IFRAME") return null;

	let doc = frame.contentDocument || frame.contentWindow.document;
	if (!doc || (doc.readyState != "complete" && doc.readyState != "interactive")) return null;

	return doc;
}

//Setar marcador
async function setMarcador(marcador, nota) {
	let docArvore = getFrameDocument("arvore");

	if (!docArvore) throw new Error("Árvore do processo não encontrada");

	let urlMarcar = (m = $(docArvore.head).html().match(/controlador\.php\?acao=andamento_marcador_gerenciar[^'"]+/i)) && m[0].replace(/&amp;/g, "&");

	if (!urlMarcar) throw new Error("URL de gerenciamento de marcação não encontrada");

	let html = await fetchData(urlMarcar);

	let form = $(html).find('#frmAndamentoMarcadorCadastro');

	if (!form.length) {
		form = (m = html.match(/controlador\.php\?acao=andamento_marcador_cadastrar[^'"]+/i)) && m[0].replace(/&amp;/g, "&");
		if (!form) throw new Error("URL de marcação não encontrada");
	}

	if (typeof nota == "function") {
		let notaAnterior = $(html).find('#tblMarcadores tbody tr:gt(0)').filter((i, tr) => $(tr).find('td:eq(1)').text().trim() == marcador).find('td:eq(2)').text().trim();

		nota = nota.constructor.name === "AsyncFunction" ? await nota({ html: html ?? form.html(), nota: notaAnterior }) : nota({ html: html ?? form.html(), nota: notaAnterior });
		if (nota instanceof Promise) nota = await nota.then(result => result).catch(e => new Error(e));
	}

	return postFormData(form, e => {
		if (marcador) {
			let option = $(e.html).find('#selMarcador option').get().find(item => $(item).text() == marcador);
			if (!option) return new Error("Marcador não encontrado");
			marcador = $(option).val();
		} else marcador = "null";

		return { hdnIdMarcador: marcador, txaTexto: nota };
	});
}

//Setar marcador
async function delMarcador(marcador) {
	let docArvore = getFrameDocument("arvore");

	if (!docArvore) throw new Error("Árvore do processo não encontrada");

	let urlDesmarcar = (m = $(docArvore.head).html().match(/controlador\.php\?acao=andamento_marcador_gerenciar[^'"]+/i)) && m[0].replace(/&amp;/g, "&");

	if (!urlDesmarcar) throw new Error("URL de gerenciamento de marcação não encontrada");

	let html = await fetchData(urlDesmarcar);

	let form = $(html).find('#frmGerenciarMarcador');
	if (!form.length) throw new Error("Formulário de gerenciamento de marcadores não encontrado");

	urlDesmarcar = (m = html.match(/controlador\.php\?acao=andamento_marcador_remover[^'"]+/i)) && m[0].replace(/&amp;/g, "&");
	if (!urlDesmarcar) throw new Error("URL de exclusão de marcador não encontrada");

	html = $(form).find('#tblMarcadores tbody tr:gt(0)').filter((i, tr) => $(tr).find('td:eq(1)').text().trim() == marcador).html();
	if (!html) return false;

	marcador = (m = html.match(/acaoRemover\(['"](\d+)/)) ? m[1] : null;

	if (!marcador) return false;

	return postFormData(urlDesmarcar, { redirectUrl: urlDesmarcar, data: { hdnInfraItemId: marcador } });
}


//Escrever anotação no processo corrente
async function addAnotacao(note) {
	let docArvore = getFrameDocument("arvore");

	if (!docArvore) throw new Error("Árvore do processo não encontrada");

	let urlAnotar = (m = $(docArvore.head).html().match(/controlador\.php\?acao=comentario_listar[^'"]+/i)) && m[0].replace(/&amp;/g, "&");

	if (!urlAnotar) throw new Error("URL da lista de comentários não encontrada");

	let html = await fetchData(urlAnotar);

	let form = $(html).find('#frmComentarioCadastro');

	if (!form.length) {
		form = (m = html.match(/controlador\.php\?acao=comentario_cadastrar[^'"]+/i)) && m[0].replace(/&amp;/g, "&");
		if (!form) throw new Error("URL de comentários não encontrada");
	}

	return postFormData(form, { txaDescricao: note });
}

//Retornar histórico completo do processo atual
async function getHistorico(filter) {
	let docArvore = getFrameDocument("arvore");

	if (!docArvore) throw new Error("Árvore do processo não encontrada");

	let urlHistorico = (m = $(docArvore.head).html().match(/controlador\.php\?acao=procedimento_consultar_historico[^'"]+/i)) && m[0].replace(/&amp;/g, "&");

	if (!urlHistorico) throw new Error("URL de histórico não encontrada");

	let html = await postFormData(urlHistorico, { hdnTipoHistorico: 'P' });

	if (!html) throw new Error("Falha ao carregar o histórico");

	let result = [];

	const columns = ['dataHora', 'unidade', 'usuario', 'descricao'];

	$(html).find('#tblHistorico tbody tr:gt(0)').each((indexRow, row) => {
		let record = {};

		$(row).find('td').each((indexCol, col) => record[columns[indexCol]] = $(col).text());

		result.push(record);
	});

	if (result.length && filter) {
		let applyFilter = f => {
			if (typeof f == 'object') {
				for (let p in f) {
					result = result.filter(r => f[p] instanceof RegExp ? f[p].test(r[p] ?? '') : r[p] == f[p]);
				}
			} else if (typeof f == 'function') result = result.filter(f);
		};

		if (Array.isArray(filter)) {
			for (f of filter) {
				applyFilter(f);
			}
		} else applyFilter(filter);
	}

	return result;
}


//Interpretar tipologia de processo para identificar o serviço de telecomunicações
function parseServicoByTipo(tipo) {
	if (m = tipo.match(/(?:([^:]+)\s*:)?\s*(.+)\s*$/i)) {
		m[1] = m[1] ? m[1].toLowerCase() : "";

		if (m[1] == "outorga") {
			switch (m[2].toLowerCase()) {
				case "rádio do cidadão": return { tipo: "LC", num: "400", desc: "Serviço Rádio do Cidadão", sigla: "PX" };
				case "radioamador": return { tipo: "LC", num: "302", desc: "Serviço de Radioamador", sigla: "RA" };
				case "slp": return { tipo: "LC", num: "019", desc: "Serviço Limitado Privado", sigla: "SLP" };
				case "limitado móvel aeronáutico": return { tipo: "LC", num: "507", desc: "Serviço Limitado Móvel Aeronáutico", sigla: "SLMA" };
				case "limitado móvel marítimo": return { tipo: "LC", num: "604", desc: "Serviço Limitado Móvel Marítimo", sigla: "SLMM" };
				case "serviços de interesse restrito": return { tipo: "OT", num: "002", desc: "Serviços de Interesse Restrito", sigla: "SIR" };
				case "serviços de interesse coletivo": return { tipo: "OT", num: "001", desc: "Serviços de Interesse Coletivo", sigla: "SIC" };
			}
		}
	}

	return undefined;
}

//Interpretar tipologia de processo para identificar o serviço de telecomunicações
function getTipoRegexByServico(servico) {

	switch (Number(servico)) {
		case 1: return /Outorga:\s*(?:Servi[cç]os?\s*de\s*)?Interesse\s*Coletivo\s*$/i;
		case 2: return /Outorga:\s*(?:Servi[cç]os?\s*de\s*)?Interesse\s*Restrito\s*$/i;
		case 19: return /Outorga:\s*SLP\s*$/i;
		case 251:
		case 252:
		case 253:
		case 254:
		case 255: return /Outorga:\s*Servi[cç]os\s*Auxiliares?\s*de\s*Radiodifus[aã]o\b/i;
		case 302: return /Outorga:\s*Radioamador\b/i;
		case 400: return /Outorga:\s*R[aá]dio\s*do\s*Cidad[aã]o\b/i;
		case 507: return /Outorga:\s*(?:Servi[cç]o\s*)?Limitado\s*M[oó]vel\s*Aeron[aá]utico\b/i;
		case 604: return /Outorga:\s*(?:Servi[cç]o\s*)?Limitado\s*M[oó]vel\s*Mar[ií]timo\b/i;
	}


	return null;
}

//Retorna descrição da tipologia de acordo com o serviço
function getDescTipologia(servico) {

	switch (Number(servico)) {
		case 1: return "Outorga: Serviços de Interesse Coletivo";
		case 2: return "Outorga: Serviços de Interesse Restrito";
		case 19: return "Outorga: SLP";
		case 251:
		case 252:
		case 253:
		case 254:
		case 255: return "Outorga: Serviços Auxiliares de Radiodifusão e Correlatos (SARC)";
		case 302: return "Outorga: Radioamador";
		case 400: return "Outorga: Rádio do Cidadão";
		case 507: return "Outorga: Serviço Limitado Móvel Aeronáutico";
		case 604: return "Outorga: Serviço Limitado Móvel Marítimo";
	}


	return null;
}

//Interpretar texto para identificar o serviço de telecomunicações
function parseServicoByText(text) {
	if (!text) return undefined;

	switch (true) {
		case /\bLTP\b|\b251\b|Transmiss.o\s+de\s+Programa/i.test(text): return { tipo: "LC", num: "251", desc: "SARC - Ligação para Transmissão de Programas", sigla: "SARC-LTP" };
		case /\bRE\b|\b252\b|Reportagem\s+Externa/i.test(text): return { tipo: "LC", num: "252", desc: "SARC - Reportagem Externa", sigla: "SARC-RE" };
		case /\bOI\b|\b253\b|Ordens\s+Interna/i.test(text): return { tipo: "LC", num: "253", desc: "SARC - Comunicação de Ordens Internas", sigla: "SARC-COI" };
		case /\bTC\b|\b254\b|Telecomando/i.test(text): return { tipo: "LC", num: "254", desc: "SARC - Telecomando", sigla: "SARC-TC" };
		case /\bTM\b|\b255\b|Telemedi..o/i.test(text): return { tipo: "LC", num: "255", desc: "SARC - Telemedição", sigla: "SARC-TM" };
	}

	if (m = text.match(/\b(?:00[12]|0?19|302|400|507|604)\b/)) {
		switch (Number(m)) {
			case 1: return { tipo: "OT", num: "002", desc: "Serviços de Interesse Restrito", sigla: "SIR" };
			case 2: return { tipo: "OT", num: "001", desc: "Serviços de Interesse Coletivo", sigla: "SIC" };
			case 19: return { tipo: "LC", num: "019", desc: "Serviço Limitado Privado", sigla: "SLP" };
			case 302: return { tipo: "LC", num: "302", desc: "Serviço de Radioamador", sigla: "RA" };
			case 400: return { tipo: "LC", num: "400", desc: "Serviço Rádio do Cidadão", sigla: "PX" };
			case 507: return { tipo: "LC", num: "507", desc: "Serviço Limitado Móvel Aeronáutico", sigla: "SLMA" };
			case 604: return { tipo: "LC", num: "604", desc: "Serviço Limitado Móvel Marítimo", sigla: "SLMM" };
		}
	}

	return undefined;
}


//Retornar descrição do código numérico do serviço de telecomunicações
function getDescServico(num) {
	switch (Number(num)) {
		case 1: return "Serviços de Interesse Coletivo";
		case 2: return "Serviços de Interesse Restrito";
		case 19: return "Serviço Limitado Privado";
		case 251: return "SARC - Ligação para Transmissão de Programas";
		case 252: return "SARC - Reportagem Externa";
		case 253: return "SARC - Comunicação de Ordens Internas";
		case 254: return "SARC - Telecomando";
		case 255: return "SARC - Telemedição";
		case 302: return "Serviço de Radioamador";
		case 400: return "Serviço Rádio do Cidadão";
		case 507: return "Serviço Limitado Móvel Aeronáutico";
		case 604: return "Serviço Limitado Móvel Marítimo"
	}

	return "";
}

//Retornar descrição do tipo de processo
function getDescTipoProcesso(tipo) {
	if (!tipo) return "Indefinido";

	switch (tipo) {
		case "CS": return "Cassação";
		case "LC": return "Licenciamento";
		case "OT": return "Outorga";
		case "PS": return "Pessoal";
		case "RF": return "Autorização RF";
		case "RD": return "Radiodifusão";
	}

	return "Indefinido";
}


//Validar FISTEL
function validateFistel(fistel) {
	if (!fistel) return false;
	fistel = fistel.replace(/\D/g, "");
	if (fistel.length != 11) return false
	return validateCpfj(fistel);
}

//Recuperar dados do SEI
function getSEI(url) {
	if (!url) return Promise.reject("URL nula");
	if (!url.toString().match(/^(?:https?:\/\/[^\/]+.*sei\/)?controlador\.php[^'"]+/i)) return Promise.reject("URL inválida");

	return Promise.resolve($.get(absoluteUrl(url)));
}

//Consultar nó da árvore SEI
function getNoSEI(id, last, script) {
	if (!id || !(id = id.trim())) return null;

	let ifr, doc;

	if (ifr = top.window.document.getElementById('ifrArvore')) doc = ifr.contentDocument || ifr.contentWindow.document;
	else return null;


	if (!script && id.match(/^\d+$/) && ifr && (objArvore = ifr.contentWindow['objArvore'])) return objArvore.getNo(id);

	if (script = (script || $(doc).find('script:contains("inicializar()")').text())) {
		let expr;

		if (id.match(/^\d+$/)) expr = `Nos\\[\\d+\\].*?=\\s*?new\\s*?infraArvoreNo\\s*?\\([^,]*?,['"]${id}['"][\\w\\W]*?Nos\\[\\d+\\].src\\s*?=\\s*['"](.*?)['"]`;
		else expr = (last ? "[\\w\\W]*" : "") + `Nos\\[\\d+\\].*?=\\s*?new\\s*?infraArvoreNo\\s*?\\(.*?${id}[\\w\\W]*?Nos\\[\\d+\\].src\\s*?=\\s*['"](.*?)['"]`;

		if (m = script.match(new RegExp(expr, ""))) return { src: m[1] };
	}

	return null;
}

//Retornar URL de documento do processo ativo
function getUrlDocumento(id, last) {
	let doc;

	if (ifr = top.window.document.getElementById('ifrArvore')) doc = ifr.contentDocument || ifr.contentWindow.document;
	else return Promise.reject(new Error("Árvore não encontrada"));

	let regex_doc_id = new RegExp(`^${id}`, "i");

	let pastas = $(doc).find('#divArvore [id^="anchorPASTA"]').get();
	let pinfo;

	let get_documento = function () {
		return new Promise((res0, rej0) => {
			if (pastas.length) {
				let pn = Number(pastas.pop().id.slice(11));

				if ($(doc).find(`#divArvore #anchorAGUARDE${pn}`).length) {
					if (!pinfo) {
						if (script = $(doc).find('script:contains("inicializar()")').text()) {
							pinfo = [];
							let m, regex = /Pastas\[(\d+)\]\s*[['".]{1,2}(\w+)[\]'".]{1,2}\s*=\s*['"](.+)['"]/gm;

							while (m = regex.exec(script)) {
								if (m.index === regex.lastIndex) regex.lastIndex++;
								m[1] = Number(m[1]);
								if (!pinfo[m[1]]) pinfo[m[1]] = [];
								pinfo[m[1]][m[2]] = m[3];
							}
						}
					}

					if (!pinfo[pn] || !pinfo[pn].link || !pinfo[pn].protocolos) {
						rej0();
						return;
					}

					let datapost = "hdnArvore=" + encodeURIComponent($(doc).find('#hdnArvore').val());
					datapost += `&hdnPastaAtual=PASTA${pn}`;
					datapost += "&hdnProtocolos=" + encodeURIComponent(pinfo[pn].protocolos);

					Promise.resolve($.post(absoluteUrl(pinfo[pn].link), datapost)).then(data => {
						if (!data) {
							rej0()
							return;
						}

						if (no = getNoSEI(id, last, data)) {
							res0(no.src);
							return;
						}
						if (pastas.length) return get_documento().then(res0, rej0);
						rej0();
					}).catch(() => {
						if (pastas.length) return get_documento().then(res0, rej0);
						rej0();
					});

				} else {

					if (doc_id = $(doc).find(`#divArvore #divPASTA${pn} [id^="anchor"][target]`).filter((index, element) => { return $(element).text().match(regex_doc_id) }).last().attr('id')) {
						if (no = getNoSEI(doc_id.substr(6))) {
							res0(no.src);
							return;
						}
					}

					if (pastas.length) return get_documento().then(res0, rej0);

					rej0();
				}

			} else {
				if (doc_id = $(doc).find('#divArvore [id^="anchor"][target]').filter((index, element) => { return $(element).text().match(regex_doc_id) }).last().attr('id')) {
					if (no = getNoSEI(doc_id.substr(6))) {
						res0(no.src);
						return;
					}
				}
				rej0();
			}

		});
	};

	return get_documento();
}


//Atualizar andamento
function atualizarAndamento(text) {
	let iframe_visualizador = window.top.document.getElementById("ifrVisualizacao");
	if (!iframe_visualizador) return Promise.reject("Visualizador não encontrado");

	let doc_visualizador = iframe_visualizador.contentDocument || iframe_visualizador.contentWindow.document;

	if (!doc_visualizador || (doc_visualizador.readyState != "complete" && doc_visualizador.readyState != "interactive")) return Promise.reject("Documento não encontrado");

	if ((html = $(doc_visualizador.body).html()) && (m = html.match(/controlador\.php\?acao=procedimento_atualizar_andamento&[^"']+/))) return postFormData(absoluteUrl(m[0]), { txaDescricao: text });
	else return Promise.reject("URL de atualização de andamento não encontrada");
}

//Enviar processo
function enviarProcesso(dest, manter, prazo) {
	let iframe_visualizador = window.top.document.getElementById("ifrVisualizacao");
	if (!iframe_visualizador) return Promise.reject("Visualizador não encontrado");

	let doc_visualizador = iframe_visualizador.contentDocument || iframe_visualizador.contentWindow.document;

	if (!doc_visualizador || (doc_visualizador.readyState != "complete" && doc_visualizador.readyState != "interactive")) return Promise.reject("Documento não encontrado");

	if ((html = $(doc_visualizador.body).html()) && (m = html.match(/controlador\.php\?acao=procedimento_enviar&[^"']+/))) {
		return postFormData(absoluteUrl(m[0]), e => {
			if (m = e.html.match(/AutoCompletarUnidade\s*=\s*new\s*infraAjaxAutoCompletar\(.*?(controlador_ajax\.php\?acao_ajax=unidade_auto_completar_envio_processo[^'"]+)/i)) {
				unid = syncAjaxRequest(absoluteUrl(m[1]), "post", "palavras_pesquisa=" + dest);
				if (!unid || !unid.ok) return Promise.reject(`Não foi possível consultar unidade "${dest}"`);

				dest = unid.response.documentElement ? unid.response.documentElement.firstChild : null;
				if (!dest) return Promise.reject(`Destino não encontrado`);

				e.data.selUnidades = dest.getAttribute("id");
				e.data.hdnUnidades = dest.getAttribute("id") + "±" + dest.getAttribute("descricao");
				e.data.hdnIdUnidade = dest.getAttribute("id");
			} else return Promise.reject("URL de consulta de destino não encontrada");

			if (manter) e.data.chkSinManterAberto = "on";
			e.data.chkSinRemoverAnotacoes = "on";

			if (prazo) {
				e.data.rdoPrazo = 2;
				e.data.txtDias = prazo;
				e.data.chkSinDiasUteis = "on";
			}
		});
	} else return Promise.reject("URL de envio de processo não encontrada");
}


//Consultar usuário externo
function consultarUsuarioExterno(id) {
	let html;

	if (!id) return Promise.reject(new Error("Identificação não informada"));

	if (!(html = $(top.window.document.body).html())) return Promise.reject(new Error("Url de listagem usuário externo não encontrada"));

	if (m = html.match(/controlador\.php\?acao=usuario_externo_listar&[^\"]+/)) {
		return new Promise((resolve, reject) => {
			Promise.resolve($.get(absoluteUrl($('<div />').html(m[0]).text()))).then(data => {
				data = $(data);

				let postdata = { txtSiglaUsuario: "", txtNomeUsuario: "", txtCpfUsuario: "" };
				data.find('#frmUsuarioLista input[type=hidden]').each((index, input) => {
					postdata[input.id] = $(input).val();
				});

				if (id.match(/^[\d.-]+$/)) postdata.txtCpfUsuario = id.replace(/\D/g, "");
				else if (id.match(/^[^@]+@[^@]+\..*$/)) postdata.txtSiglaUsuario = id;
				else postdata.txtNomeUsuario = id;

				let str_postdata = "";

				for (let prop in postdata) {
					if (postdata.hasOwnProperty(prop)) str_postdata += (str_postdata ? "&" : "") + prop + "=" + encodeURIComponent(postdata[prop]).replace(/ /g, "+");
				}

				if (str_postdata) {
					Promise.resolve($.post(absoluteUrl(data.find('#frmUsuarioLista').attr('action')), str_postdata)).then(data => {
						data = $(data);

						if (($rows = data.find('.infraTable>tbody>tr:gt(0)')) && $rows.length) {
							let result;
							for (i = 0; i < $rows.length; i++) {
								let $row = $rows.eq(i);
								result = { nome: $row.find('td:eq(2)').text(), email: $row.find('td:eq(1)').text(), status: ($row.find('td:eq(3)').text() == "S") ? "pendente" : "ok" };
								if (result.status != "pendente") break;
							}


							resolve(result);
						} else reject(new Error("Não encontrado"));

					}).catch(() => {
						reject(new Error("Não encontrado"))
					});
				} else reject(new Error("Não encontrado"));


			}).catch(() => {
				reject(new Error("Não encontrado"))
			});

		});
	} else return Promise.reject(new Error("Url de listagem usuário externo não encontrada"));
}

//Retorna nó do documento selecionado no processo
function getCurrentNode() {
	if ((arvore_doc = getFrameDocument("arvore")) && (anchor = $(arvore_doc).find('.infraArvoreNoSelecionado').closest('a').get(0))) return anchor;
	return null;
}

//Retorna o número do processo atual
function getCurrentProcesso() {
	if ((arvore_doc = getFrameDocument("arvore")) && (proc = $(arvore_doc).find('#header a[id^=anchor]').text())) return proc.trim();
	else if (proc = $('#header').find('a[id^=anchor]').text()) return proc.trim();
	else return "";
}

//Aplicar formato a conteudo
function formatValue(value, format) {
	if (!format || !value) return value;

	switch (format.toLowerCase()) {
		case "up": return value.toUpperCase();
		case "low": return value.toLowerCase();
		case "num": return value.replace(/\D/g, "");
		case "ano": return (d = value.toString().toDate()) ? d.getFullYear() : "0";
		case "ext":
			let md;
			if (md = value.match(/(\d{2})\/(\d{2})\/(\d{4})/)) {
				let mes = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
				return `${Number(md[1])} de ${mes[Number(md[2]) - 1]} de ${md[3]}`;
			} else return value;

		default: return extractString(value, format);
	}
}


//Retornar dados do usuário corrente {login,nome}
function getCurrentUser() {
	if ((a = top.window.document.getElementById('lnkUsuarioSistema')) && (m = a.getAttribute("title").match(/^(.+)[-(]\s*(.+)\b\/ANATEL/i))) return { login: m[2], name: m[1].trim() };
	return null;
}

//Retornar dados do usuário corrente {login,nome}
function getCurrentLotacao() {
	if (sel = top.window.document.getElementById('selInfraUnidades')) return $(sel).find('option:selected').text().trim();
	return null;
}

//Retornar informações do processo corrente
function getCurrentProcessoInfo() {

	let doc = getFrameDocument("arvore");
	if (!doc) return null;

	let det = $(doc).find("#panelDetails").get(0);
	if (!det) return null;

	let result = {};

	$(det).find('p').each(function () {
		if (f = parseField($(this).text())) {
			f.name = identityNormalize(f.name);
			if (f.name == "interessados") {
				f.name = "interessado";
				f.value = $(this).next("ul").find("li").get().map(item => $(item).text());
			}

			result[f.name] = f.value;
		}
	});

	result.codServico = Number($(det).find('#hdnServico').val());
	result.cpfj = $(det).find('#hdnInteressadoPrincipal').val();
	result.nome = $(det).find('#hdnInteressadoPrincipal').attr('text');
	result.cpfj = validateCpfj(result.cpfj) ? result.cpfj.replace(/\D/g, "") : undefined;
	result.cpf = result.cpf || (validateCpfj(result.cpfj) && result.cpfj.length == 11 ? result.cpfj : validateCpfj(result.cpf) ? result.cpf.replace(/\D/g, "") : undefined);
	result.cnpj = result.cnpj || (validateCpfj(result.cpfj) && result.cpfj.length == 14 ? result.cpfj : validateCpfj(result.cnpj) ? result.cnpj.replace(/\D/g, "") : undefined);
	result.cpfj = result.cpf || result.cnpj;

	return result;
}

function addCommand(id, icon, title, list, callback) {

	if (!callback && typeof list == "function") {
		callback = list;
		list = null;
	}

	var ifrVisualizacao;
	var btn = document.getElementById(id);
	if (!btn && (ifrVisualizacao = window.top.document.getElementById("ifrVisualizacao"))) btn = ifrVisualizacao.contentDocument.getElementById(id);

	if (!btn) {
		var div_commands = document.getElementById("divComandos");
		if (!div_commands && ifrVisualizacao) div_commands = ifrVisualizacao.contentDocument.getElementById("divArvoreAcoes");
		if (!div_commands) return;

		btn = document.createElement('a');
		btn.id = id;
		btn.href = "javascript:void(0);";
		btn.setAttribute("tabindex", "452");

		let first_img = div_commands.querySelector('img');

		var img = document.createElement("img");
		if (!first_img || $(first_img).is('.infraCorBarraSistema')) img.className = "infraCorBarraSistema";

		btn.appendChild(img);

		while ((node = div_commands.lastChild) && (node.nodeType == 3) && !node.nodeValue.trim()) node.remove();

		div_commands.appendChild(btn);
	} else $(btn).off("click");

	$(btn).find("img").attr("src", getResourcePath(icon)).attr("title", title);
	$(btn).on("click", callback);

	if (list) createPopupMenu(btn, list, { dropButton: "menu-drop-button" }, callback);
}


//Extrair parte de uma string
function extractString(value, start, end) {
	if (!value || start === undefined || start === null) return value;

	if (typeof start == "string") {
		if (m = start.match(/^(-?\d+)(?:,(-?\d+))?$/)) {
			start = Number(m[1]);
			if (m[2]) end = Number(m[2]);
		} else {
			if (!isNaN(start)) return value;
			start = Number(start);
		}
	} else if (typeof start != "number") return value;

	if (typeof end == "string") end = isNaN(end) ? 0 : Number(end);

	return value.slice(start, end);
}