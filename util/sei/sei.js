/***********************************************/
/* Definição de compatibilidade para o Chrome  */
/***********************************************/
var browser = browser || chrome;

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



/** Objeto com informações de documento/processo */
class NodeSei {
	#href = undefined;
	#__doc = undefined;
	#__fullName = undefined;
	#__date = undefined;
	#__bm = undefined;

	get fullName() {
		if (this.#__fullName !== undefined) return this.#__fullName;
		this.readDocument();
		return this.#__fullName;
	}

	get date() {
		if (this.#__date !== undefined) return this.#__date;
		this.readDocument();
		return this.#__date;
	}

	get year() {
		if (this.#__date !== undefined) return this.#__date.slice(-4);
		this.readDocument();
		return this.#__date ? this.#__date.slice(-4) : '';
	}

	get bm() {
		if (this.#__bm !== undefined) return this.#__bm;
		this.readDocument();
		return this.#__bm;
	}

	get bm() {
		if (this.#__bm !== undefined) return this.#__bm;
		this.readDocument();
		return this.#__bm;
	}


	/**
	 * Criar instância de NodeSei
	 * @param {object} source
	 */
	constructor(source) {
		if (!source) throw new Error("Fonte nula");

		const regex_text = /^\s*(\d{5}\.\d{6}\/\d{4}\-\d{2})\s*$|^\s*(([^\s]+)[^\d]*(\b\d+\b)?.*)\s+\(?(\d+)\)?\s*$/;
		let m, r;

		if (typeof source == 'object') {

			if (source instanceof Element) {
				if (source.tagName != 'A') source = source.closest('a');
				if (!source || !(m = $(source).text().match(regex_text))) throw new Error("Fonte inválida");
			} else {
				let fields = ["name", "type", "tipology", "sei", "id", "extern", { date: "#__date", bm: "#__bm", fullName: "#__fullName" }];
				for (let f in fields) {
					if (typeof f === "string") this[f] = source[f];
					else for (let k in Object.keys(fields[f])) this[fields[f][k]] = source[k];
				}
				this.#__doc = null;
				return;
			}

		} else if (typeof source == 'string') {
			let data = [];
			r = /(?<=")[^"]*?(?=",)|[^,"]+/g;
			while (m = r.exec(source)) {
				if (m.index === r.lastIndex) r.lastIndex++;
				data.push(m[0]);
			}
			if (!data.length || !(m = data[5].match(regex_text))) throw new Error("Formato inválido da fonte");
			source = data;
		} else throw new Error("Tipo de fonte desconhecido");

		if (m[1]) {
			this.name = 'Processo ' + m[1];
			this.type = "PC";
			this.tipology = 'processo';
			this.sei = m[1].replace(/\D/g, "");
		} else {
			this.name = m[2];
			this.type = NodeSei.translateType(m[3]);
			this.tipology = filterAccents(m[3], String.prototype.toLowerCase);
			this.sei = m[5];
		}

		if (m[4]) this.num = m[4];

		if (Array.isArray(source)) {
			this.id = source[1];
			this.#href = source[source.length - 1];
			this.extern = !!(source[7] && source[7].match(/\bpdf\./i));
		} else {
			this.id = $(source).attr('id').replace(/\D/g, '');
			syncWaitDocumentReady(source.ownerDocument);

			let data = source.ownerDocument.documentElement.innerHTML.match(new RegExp(`controlador\\.php\\?acao=documento_visualizar&.*?&id_documento=${this.id}\\b[^'"]*`, "i"));
			this.#href = data ? data[0] : null;

			if (this.id && (data = $(source.ownerDocument).find(`#icon${this.id}`).attr('src'))) this.extern = !!data.match(/pdf\./i);
			else this.extern = false;
		}

		if (this.extern) this.#__fullName = this.name;
	}

	readDocument() {
		if (this.#__doc !== undefined) return this.#__doc;
		this.#__doc = null;
		this.#__date = '';
		this.#__bm = null;
		this.#__fullName = this.name;

		if (this.type == 'PC') return this.#__doc;

		let m;

		if (this.extern) {
			let doc_arvore = getFrameDocument('arvore');
			m = doc_arvore && $(doc_arvore).find('script:contains("inicializar()")').text();

			if (m = m && m.match(new RegExp(`controlador\\.php\\?acao=documento_alterar_recebido\\b.*?id_documento=${this.id}[^"]+`, 'i'))) {
				let result = syncAjaxRequest(m[0]);
				if (result.ok && (result = $(result.response).find("#txtDataElaboracao").val())) this.#__date = result;
			}

		} else if (this.#href) {
			let frame = window.top.document.getElementById("ifrVisualizacao") || (window.opener && window.opener.top.document.getElementById("ifrVisualizacao"));
			if (frame && frame.src == this.#href) this.#__doc = getFrameDocument('documento');
			else {
				let result = syncAjaxRequest(this.#href, 'GET', null, { domParse: true });
				if (!result.ok) return false;
				this.#__doc = result.response;
			}

			if (this.#__doc) {
				if ((m = this.#__doc.body.children[this.#__doc.body.children.length - 1].innerText) && (m = m.match(/[0123]\d\/[01]\d\/\d{4}/))) this.#__date = m[0];

				if (m = this.#__doc.body.innerText.match(/(?:Ofício|Informe|Ato)\s*nº\s*\d+[^>\n\r]*?(?:199\d|20\d{2})(?:[\w\d/-]+)?/i)) this.#__fullName = m[0];

				$(this.#__doc).find('[bm]').each((index, item) => {
					if (m = identityNormalize($(item).attr("bm"))) {
						if (!this.#__bm) this.#__bm = {};
						this.#__bm[m] = $(item).text().replace(/[\n\t\r]/g, "");
					}
				});
			}
		}

		return this.#__doc;
	}

	async asyncReadDocument() {
		return this.readDocument();
	}

	toString() {
		return this.name;
	}

	static translateType(ref) {
		if (typeof ref == 'string') {
			if (!(ref = ref.trim())) return '';

			if (ref.length <= 2) {
				switch (ref.toUpperCase()) {
					case 'PC': return 'Processo';
					case 'OF': return 'Ofício';
					case 'IF': return 'Informe';
					case 'AT': return 'Ato';
					case 'EX': return 'Documento Externo';
					case 'DP': return 'Despacho';
					case 'CL': return 'Checklist';
					case 'LC': return 'Licença';
					case 'RL': return 'Relatório';
					default: return 'Documento';
				}
			}

			ref = filterAccents(ref, String.prototype.toLowerCase);
			switch (true) {
				case /^[\d.-\/]{15,20}/i.test(ref): return 'PC';
				case /^oficio/i.test(ref): return 'OF';
				case /^informe/i.test(ref): return 'IF';
				case /^ato/i.test(ref): return 'AT';
				case /^despacho/i.test(ref): return 'DP';
				case /^check/i.test(ref): return 'CL';
				case /^licen[cç]a/i.test(ref): return 'LC';
				case /^relat[oó]rio/i.test(ref): return 'RL';
				default: return '';
			}
		}

		if (ref instanceof Element) {
			if (ref.tagName != 'A') ref = ref.closest('a');
			if (!ref) return false;

			let result = NodeSei.translateType(ref.text);
			if (!result) {
				let aid = $(ref).attr('id').replace(/\D/g, '');
				if (aid && (aid = ref.ownerDocument.querySelector('icon' + aid)) && $(aid).attr('src').match(/pdf\./i)) return 'EX';
			}
			return result;
		}

		return false;
	}
}


/**
 * Consultar informações de nós da ávore Sei
 * @param {(string | RegExp | Object)} [query] Se nada for informado, traz todos os nós da árvore atual do processo atual
 * @param {OptionsQueryNodeSei} [options] Opções de consulta
 * @returns {NodeSei} Resultado da consulta
 */
async function queryNodeSei(query, options) {
	var doc = (options && options.doc) || getFrameDocument("arvore");
	if (!doc) throw new Error("Documento da árvore não encontrada");

	var fetch = false;

	if (typeof query == 'string' && query.match(/\d{5}\.?\d{6}\/(?:19|20)\d{2}(?:\-\d{2})?|\d{6,7}/)) {
		fetch = true;
		query = { sei: query };
	} else fetch = typeof query == 'object' && query.sei && Object.keys(query).length == 1 && (query.sei = query.sei.toString()) && query.sei.match(/\d{5}\.?\d{6}\/(?:19|20)\d{2}(?:\-\d{2})?|\d{6,7}/);

	if (fetch) {
		query.sei = query.sei.replace(/\D/g, "");
		let m, anchor, anchors = $(doc).find('a[id^=anchor][target=ifrVisualizacao]').get();
		if (anchors && (anchor = anchors.find(a => m = $(a).text().match(/(?<=.*\(?)(\d{5}\.?\d{6}\/(?:19|20)\d{2}(?:\-\d{2})?|\d{6,7})\)?\s*$/) && m[1].replace(/\D/g, "") == query.sei))) return new NodeSei(anchor);
	}

	var tree = options && options.tree && Array.isArray(options.tree) && options.tree.length ? options.tree : [];
	var node;

	if (!tree.length) {
		var pastas = $(doc).find('#divArvore [id^="anchorPASTA"]').get();
		var pinfo;

		while (pastas.length && !(query && (query === 'last' || query.last === true))) {
			let pn = Number(pastas.shift().id.slice(11));

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

				if (!pinfo[pn] || !pinfo[pn].link || !pinfo[pn].protocolos) return Promise.reject("Informação de pasta não encontrada");

				let data = await getAjaxContent(absoluteUrl(pinfo[pn].link), {
					method: "post", params: {
						hdnArvore: encodeURIComponent($(doc).find('#hdnArvore').val()),
						hdnPastaAtual: `PASTA${pn}`,
						hdnProtocolos: encodeURIComponent(pinfo[pn].protocolos)
					}
				});


				if (!data) throw new Error(`Falha na consulta da pasta ${pn}.`);

				let regex_node = /(?<=Nos\[(\d+)\].*?=\s*new\s*infraArvoreNo\(\s*)(?:"DOCUMENTO"|"PROCESSO")\s*,\s*(?:"[^"]*?"\s*,?\s*|[\w\s]+\s*,?\s*)*?(?=\);)/ig;
				let regex_src = /Nos\[\d+\]\.src.*?["']([^"']*)/i;

				while (node = regex_node.exec(data)) {
					if (node.index === regex_node.lastIndex) regex_node.lastIndex++;
					regex_src.lastIndex = regex_node.lastIndex;
					let src = regex_src.exec(data);
					if (src) node[0] += ',"' + (src[1] ?? "") + '"';
					let d = new NodeSei(node[0]);
					if (query && (query === "first" || query.first === true)) return d;
					tree.push(d);
				}
			}
		}

		$(doc).find('#divArvore a[id^=anchor][target=ifrVisualizacao]').each((index, item) => {
			let d = new NodeSei(item);
			if (query && (query === "first" || query.first === true)) return d;
			tree.push(d);
		});

		if (options && options.tree) options.tree = tree;
	}

	if (!tree.length) return null;

	if (query) {

		let create_filter_function = (f) => {
			if (typeof f == "string") {
				f = f.trim();
				if (f.match(/^(?:\d{5}\.?\d{6}\/(?:19|20)\d{2}(?:\-\d{2})?|\d{6,7})$/)) {
					f = f.replace(/\D/g, "");
					return (n) => n.sei == f;
				}

				if (f.match(/\$[a-z_]+\w*/i)) return (n) => testExpression(f, null, Object.freeze(n));

				f = filterAccents(f.replace(/\s{2,}/g, " "));
				let regex_filter = new RegExp(f, "i");
				return (n) => regex_filter.test(filterAccents(n.name.replace(/\s{2,}/i, " ")));
			}

			if (f instanceof RegExp) return (n) => f.test(filterAccents(n.name));

			if (typeof f == 'object') {
				return (n) => {
					for (let k of Object.keys(f))
						if (f[k] === '?' && n[k]) continue;
						else if (n[k] !== f[k]) return false;

					return true;
				};
			}

			return (n) => true;
		};


		switch (typeof query) {
			case "string":
				if (query === 'first') return tree[0];
				if (query === 'last') return tree[tree.length - 1];
				tree = tree.filter(create_filter_function(query));
				break;

			case "number":
				return tree[query];

			case "object":
				if (query.first) {
					if (typeof query.first == "boolean") return tree[0];
					return tree.find(create_filter_function(query.first));
				}

				if (query.last) {
					if (typeof query.last == "boolean") return tree[tree.length - 1];

					let filter = create_filter_function(query.last);
					let i = tree.length - 1;
					while (i >= 0) {
						if (filter(tree[i])) return tree[i];
						i--;
					}
					return null;
				}

				tree = tree.filter(create_filter_function(query));
				break;
		}
	}

	if (fetch && !tree.length) {
		let form = top.window.document.getElementById('frmProtocoloPesquisaRapida') || (window.opener && window.opener.top.document.getElementById("frmProtocoloPesquisaRapida"));
		if (form) {
			let data = await getAjaxContent(absoluteUrl(form.getAttribute("action")), { method: "post", params: { txtPesquisaRapida: query.sei.replace(/\D/g, "") } });
			if (data) {
				let parser = new DOMParser();
				let data_doc = parser.parseFromString(data, "text/html");
				return data_doc && queryNodeSei(query, { doc: data_doc });
			}
		}
		return null;
	}

	return tree.length ? (tree.length == 1 ? tree[0] : tree) : null;
}



/**
 * Retornar informações do nó selecionado no processo 
 * @returns {NodeSei} Objeto com informações da referência
 */
function getCurrentNodeSei() {
	try {
		return new NodeSei((arvore = getFrameDocument("arvore")) && $(arvore).find('.infraArvoreNoSelecionado').closest('a').get(0));
	} catch (err) {
		return null;
	}
}


/**
 * Converte dados em objeto referência
 * @param {(string | NodeSei)} data Dado que será convertido em objeto referência
 * @returns {Reference} Resultado da conversão
 */
function referenceFromData(data) {
	if (!data) return null;

	if (typeof data === 'string') {
		const regex = /ref\.(?:([^.;]*?)\.)?([^=;]*?)\s*=\s*([^;]*?)\s*;/gi;
		let value, result = undefined;

		while ((m = regex.exec(data)) !== null) {
			if (m.index === regex.lastIndex) regex.lastIndex++;
			if (!result) result = {};

			value = m[3];
			if (value === 'true' || value === 'false') value = value == 'true';

			if (m[1]) {
				if (!result[m[1]]) result[m[1]] = {};
				result[m[1]][m[2]] = value;
			} else result[m[2]] = value;
		}

		return result;
	}

	if (data instanceof NodeSei) {
		let fields = { name: "nome", type: "tipo", tipology: "tipologia", sei: "sei", id: "id", extern: "externo", date: "data", bm: "bm", fullName: "texto" };
		let result = {};
		for (let k of Object.keys(fields)) result[fields[k]] = data[k];
		if (typeof result.data === 'string') result.ano = result.data.slice(-4);
		return result;
	}
}


/**
 * Converter objeto referência para string 
 * @param {Reference | NodeSei} reference Objeto referência a ser convertido
 * @returns {String} Resultado da conversão
 */
function referenceToString(reference) {
	if (!reference) return "";

	let result = "";
	if (reference instanceof NodeSei) reference = referenceFromData(reference);

	for (let name in reference) {
		if (reference.hasOwnProperty(name)) {
			if (typeof reference[name] == "object") {
				for (let prop in reference[name]) {
					if (reference[name].hasOwnProperty(prop)) result += `ref.${name}.${prop}=${reference[name][prop]};`;
				}
			} else result += `ref.${name}=${reference[name]};`;
		}
	}

	return result;
}



//Retornar campo(s) do processo corrente 
function getCurrentFields(filter) {
	let doc;

	if (ifr = top.window.document.getElementById('ifrArvore')) doc = ifr.contentDocument || ifr.contentWindow.document;
	else return null;

	let result = $(doc.body).find('.proc-field').get();

	if (!result.length) return null;

	result = result.map(elem => {
		return { name: $(elem).attr('field-name'), value: $(elem).find(':last').text() };
	});

	if (filter) {
		let only_name = (typeof filter == "string");

		result = result.filter(f => {
			return only_name ? f.name == filter : (filter.test(f.name) || filter.test(f.value));
		});

		if (result.length == 1) result = result[0];
	}

	return result;
}


//Interpretar texto para retornar campos
function fieldsFromString(text) {
	if (!text) return undefined;

	const regex = /\b([^:=]+)\b\W*[:=]\s*([^;]*?)\s*(?:$|\n|;|\n)/gi;
	let ret = undefined;
	let m;

	while ((m = regex.exec(text)) !== null) {
		if (m.index === regex.lastIndex) regex.lastIndex++;
		if (!ret) ret = [];
		ret.push({ name: m[1], value: m[2] });
	}

	return ret;
}


//Interpretar texto para retornar campo
function parseField(text) {
	if (!text) return undefined;

	if (m = text.match(/\b([^:=]+)\b\W*[:=]\s*([^;]*?)\s*(?:$|\n|;|\n)/i)) return { name: m[1], value: m[2] };
	else return undefined;
}


//Retornar campo de acordo com o nome
function findField(fields, name, accuracity) {
	name = identityNormalize(name);
	if (!fields || !fields.length || !name) return null;

	accuracity = accuracity <= 0 ? 0.75 : accuracity > 1 ? 1 : accuracity;

	var max = 0, index = -1;

	fields.forEach(function (item, i) {
		let weight = diceCoefficient(identityNormalize(item.name), name);
		if (weight >= accuracity && weight > max) {
			max = weight;
			index = i;
		}
	});

	if (index < 0) return null;

	return fields[index];
}


//Comparar nome de campo
function testFieldNames(fieldName, names, accuracity) {
	if (!fieldName || !names) return false;

	if (names instanceof RegExp) return names.test(fieldName);

	fieldName = identityNormalize(fieldName);
	accuracity = accuracity <= 0 ? 0.75 : accuracity > 1 ? 1 : accuracity;

	if (typeof names == "string") {
		if (!names.includes(",")) return diceCoefficient(fieldName, identityNormalize(names)) >= accuracity;
		names = names.split(",");
	}

	if (!Array.isArray(names)) return false;


	return names.some(item => { return diceCoefficient(fieldName, identityNormalize(item)) >= accuracity });

}


//Retornar valor de campo
function findFieldValue(fields, name, accuracity, format) {
	if (typeof accuracity == "string") {
		format = accuracity;
		accuracity = 0;
	}

	let f = findField(fields, name, accuracity);
	if (!f) return null;
	return formatValue(f.value, format);
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


//Transformar array de campos para string
function fieldsToString(fields, withSemiColon) {
	if (!fields) return "";
	if (!Array.isArray(fields)) fields = [fields];

	let str = "";
	fields.forEach((f) => {
		if (str) str += "\n";
		str += `${f.name}: ${f.value}`;
		if (withSemiColon) str += ";";
	});

	return str;
}


//Salvar campos no processo corrente
async function storeFields(fields, append) {
	let doc = getFrameDocument("arvore");
	var url;

	if ((html = $(doc).find('head').html()) && (m = html.match(/controlador\.php\?acao=procedimento_alterar&[^\"]+/))) url = absoluteUrl(m[0]);
	if (!url) throw "URL de alteração do processo não encontrada";

	let original_fields;

	return updateFormSEI(url, d => {
		let obs = $(d).find("#txaObservacoes").val();

		if (append && (original_fields = fieldsFromString(obs))) {
			for (orig of original_fields) if (!findField(fields, orig.name, 0.85)) fields.push(orig);
		}

		//--- limpar campos
		obs = obs.replace(/\b([^:=]+)\b\W*[:=]\s*([^;]*?)\s*(?:$|\n|;|\n)/gi, "") + fieldsToString(fields, true);

		$(d).find("#txaObservacoes").val(obs);
	}).then(() => fields);

}


//Limpar campos do processo corrente
async function clearFields() {
	return storeFields(null);
}


//Atualizar campos do processo atual
async function refreshFields(fields) {
	let doc = getFrameDocument("arvore");

	if (!doc) return;

	let panel = $(doc).find('#panelDetails').get(0);

	if (!panel) return;

	if (!fields || !fields.length) {
		fields = [];
		$(panel).find('.proc-field').each(function () { fields.push(parseField($(this).text())) });
	}

	$(panel).find('.proc-field').remove();
	let last_p = $(panel).find('p:contains("Interessado:"):last').get(0) || $(panel).find('p:contains("Interessados:"):last').get(0) || $(panel).find('p:last').get(0);

	if (fields) fields.forEach((f) => { $(last_p).before($(`<p class="proc-field" field-name="${identityNormalize(f.name)}"><label>${f.name}: </label><span class='actionable'>${f.value}</span></p>`)) });
	applyActionPanel('.proc-field span')

	$(panel).get(0).removeCommand("icon-refresh");

	notify("success", "Campos atualizados");
}


//Retornar o usuário sei corrente
function getCurrentUsuarioExterno(fields) {
	if (!fields) fields = getCurrentFields();
	if (f = findField(fields, "usuario_sei", 0.65)) {
		if (f.value.match(/\b(?:pendente|n[aã]o\s*informado|n[aã]o\s*identificado)\b/i)) return null;
		return f.value;
	} else return undefined;
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
function getCurrentProcInfo() {

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


//Capturar processo
function captureProcesso() {
	var fetch_proc = function () {

		var fetch_form = function () {
			let form_ctrl = $("#frmProcedimentoControlar").get(0);
			if (form_ctrl && $("#hdnMeusProcessos").val() == "T") return Promise.resolve(form_ctrl);

			waitMessage("Buscando processos ...");

			if (form_ctrl) return postFormData(form_ctrl, { hdnMeusProcessos: "T" }).then(data => {
				if (form_ctrl = $(data).find("#frmProcedimentoControlar").get(0)) return Promise.resolve(form_ctrl);
				return Promise.reject("Formulário de controle não encontrado");
			});

			let link_html = $(top.window.document).find('#lnkControleProcessos').prop("outerHTML");
			let url_controlar = (m = link_html.match(/controlador\.php\?acao=procedimento_controlar[^'"]+/i)) && m[0].replace(/&amp;/g, "&");

			//let url_controlar = (m = $(document.body).html().match(/controlador\.php\?acao=procedimento_controlar[^'"]+/i)) && m[0].replace(/&amp;/g, "&");
			if (!url_controlar) return Promise.reject("URL de formulário de controle não encontrado");

			return postFormData(url_controlar, { formId: "frmProcedimentoControlar", data: { hdnMeusProcessos: "T" } }).then(data => {
				if (form_ctrl = $(data).find("#frmProcedimentoControlar").get(0)) return Promise.resolve(form_ctrl);
				return Promise.reject("Formulário de controle não encontrado");
			});
		};

		return fetch_form().then(form => {
			let post_data = {};
			let $rows = $(form).find("#tblProcessosRecebidos tr.infraTrMarcada, #tblProcessosGerados tr.infraTrMarcada, #tblProcessosDetalhado tr.infraTrMarcada");

			if (!$rows.length) {
				waitMessage("Selecionando processo ...");

				let regex_umi = /(?:DDE|UMI):(\d{2})\/(\d{2})\/(\d{4});/i;

				$rows = $(form).find("#tblProcessosRecebidos>tbody>tr:gt(0), #tblProcessosGerados>tbody>tr:gt(0), #tblProcessosDetalhado>tbody>tr:gt(0)").filter((index, row) => {
					if (row.umi == undefined) {
						if (m = regex_umi.exec($(row).find('a[href*="acao=anotacao_registrar"]').attr("onmouseover"))) row.umi = new Date(m[3], m[2] - 1, m[1]);
						return row.umi && (!(txt = $(row).find("td:last").text()) || !txt.trim().length);
					} else return row.umi && (!(txt = $(row).find("td:last").prev().text()) || !txt.trim().length);
				}).sort((a, b) => { return a.umi - b.umi }).first();

				if (!$rows.length) return Promise.reject("Processos não selecionado");

				if ((ckb = $rows.find(":checkbox").get(0)) && (m = $(ckb).attr("onclick").match(/infraSelecionarItens\(.*,['"](.*)['"]/i))) {
					post_data[ckb.name] = $(ckb).val();
					post_data[`hdn${m[1]}ItensSelecionados`] = $(ckb).val();
				} else return Promise.reject("Processo não selecionado");
			}

			return Promise.resolve({ form: form, data: post_data, rows: $rows.get() });
		});
	};


	return fetch_proc().then(p => {
		let url_atribuir = (m = $(p.form).html().match(/controlador\.php\?acao=procedimento_atribuicao_cadastrar[^'"]+/i)) && m[0].replace(/&amp;/g, "&");

		if (!url_atribuir) return Promise.reject("URL de atribuição não encontrada");

		let user = getCurrentUser();

		waitMessage("Atribuindo processos ...");

		return postFormData(p.form, { url: url_atribuir, data: p.data }).then(data => {
			let frm = $(data).find("#frmAtividadeAtribuir").get(0);

			if (!frm) return Promise.reject("Carregamento do formulário de atribuição falhou");

			return postFormData(frm, e => {
				let regex = new RegExp(`^${user.login}`, "i");
				let opt = $(e.html).find('#selAtribuicao option').get().find(it => { return regex.test($(it).text()) });

				if (!opt) return Promise.reject("Opção não encontrada");

				e.data.selAtribuicao = $(opt).val();
			});

		}).then(data => {
			if (p.rows.length > 1) {
				p.rows.forEach(row => {
					$(row).find("td:last").prev().html(`<span title="${user.name}">(${user.login})</span>`);
				});
			}

			waitMessage(null);
			browser.runtime.sendMessage({ action: "notify-success", title: 'Captura', content: 'Captura concluída com sucesso' });

			if (p.rows.length == 1) top.window.open($(p.rows[0]).find("a[href*='acao=procedimento_trabalhar&']").attr("href"), "_self");

		});

	}).catch(error => {
		waitMessage(null);
		browser.runtime.sendMessage({ action: "notify-fail", title: 'Captura', content: error });
	});
}


function captureNextProcesso() {
	try {
		let user = getCurrentUser();
		let link_html = $(top.window.document).find('#lnkControleProcessos').prop("outerHTML");

		let url_controlar = (m = link_html.match(/controlador\.php\?acao=procedimento_controlar[^'"]+/i)) && m[0].replace(/&amp;/g, "&");
		if (!url_controlar) throw "URL de formulário de controle não encontrado";

		waitMessage("Consultando lista de processos...");
		getSEI(url_controlar).then(data => {
			let form = $(data).find("#frmProcedimentoControlar").get(0);
			if (!form) throw "Formulário de controle não encontrado";

			let regex_user = new RegExp(`\\(${user.login}\\)`, "i");

			let row = $(form).find("#tblProcessosRecebidos>tbody>tr:gt(0), #tblProcessosGerados>tbody>tr:gt(0), #tblProcessosDetalhado>tbody>tr:gt(0)").filter((i, r) => { return regex_user.test($(r).text()) }).get(0);
			if (!row) return captureProcesso();

			waitMessage(null);
			browser.runtime.sendMessage({ action: "notify-success", title: 'Captura', content: 'Captura concluída com sucesso' });
			top.window.open($(row).find("a[href*='acao=procedimento_trabalhar&']").attr("href"), "_self");
		}).catch(error => { throw error });
	} catch (err) {
		waitMessage(null);
		browser.runtime.sendMessage({ action: "notify-fail", title: 'Captura', content: err });
	}
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
		// btn.className = "botaoSEI";
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


/***** INTEGRAÇÃO COM A SUITE CFOR *****/
async function addControlePagto(fistel, processo, servico, debitos, nome) {
	fistel = fistel && fistel.replace(/\D/g, ",") && fistel.split(",").filter(item => validateFistel(item)).join(",");
	processo = processo && processo.replace(/\D/g, "");

	if (!fistel || !processo) throw "Fistel ou Número de Processo inválido";

	servico = servico && servico.toString().replace(/\D/g, "").padStart(3, "0");

	return addCpag(processo, servico, fistel).then(result => console.log("OK: ", result)).catch(err => console.log("ERROR: ", err));

	/*
	if (debitos === true) debitos = "t";
	else if (typeof debitos == "string" && debitos.length) debitos = debitos[0].toLowerCase();
	else throw "Tipo de débitos inválido"
	
	browser.runtime.sendMessage({action: "popup", url: getCforUrl(`cpag/cfor-ext.php?acao=incluir&processo=${processo}&servico=${servico}&fistel=${fistel}&debitos=${debitos}&nome=${nome}`), options: {width: 540, height: 220}});
	*/
	return true;
}


/***** ATUALIZAÇÕES DOS PAINÉIS ******/
//Aplicar ações de painel
function applyActionPanel(items) {
	//--- configurações para os campos acionáveis
	var actions = ["copy",

		{
			action: "reg",
			icon: "icon-search",
			title: "Consultar Regularidade",
			condition: function (e) { return !testFieldNames($(e.currentTarget).closest('.proc-field').attr('field-name'), /\bfistel\b/i) && validateCpfj($(this).text()) },
			callback: async function (e) {
				let cpfj = $(this).text().replace(/\D/g, "");

				setClipboard(cpfj);

				let urls = [`http://sistemasnet/sigec/ConsultasGerais/SituacaoCadastral/tela.asp?acao=c&NumCNPJCPF=${cpfj}&indTipoComparacao=e&hdnImprimir=true`];

				if (!e.ctrlKey) {
					urls.push(`http://sistemasnet/sigec/ConsultasGerais/NadaConsta/certidao.asp?CND=1&ValidaSistema=SIGEC&NumCNPJCPF=${cpfj}&acao=c&cmd`);

					if (cpfj.length == 11) {
						let nasc = /*e.altKey && */await openFormDlg([{ id: "nasc", type: "date", label: "Data de Nascimento", required: true }], "Consulta").then(data => data.nasc).catch(err => null);

						if (nasc) urls.push(`https://servicos.receita.fazenda.gov.br/Servicos/CPF/ConsultaSituacao/ConsultaPublica.asp?CPF=${cpfj}&NASCIMENTO=${nasc}`);
						else urls.push(`https://servicos.receita.fazenda.gov.br/Servicos/CPF/ConsultaSituacao/ConsultaPublica.asp?CPF=${cpfj}`);

					} else {
						urls.push(`http://www.receita.fazenda.gov.br/PessoaJuridica/CNPJ/cnpjreva/cnpjreva_solicitacao2.asp?CNPJ=${cpfj}`);
						//urls.push(`http://servicos.receita.fazenda.gov.br/Servicos/certidao/CndConjuntaInter/InformaNICertidao.asp?Tipo=1&NI=${cpfj}`); 
						urls.push(`http://www.portaltransparencia.gov.br/sancoes/ceis?paginacaoSimples=true&tamanhoPagina=&offset=&direcaoOrdenacao=asc&colunasSelecionadas=linkDetalhamento%2CcpfCnpj%2Cnome%2CufSancionado%2Corgao%2CtipoSancao%2CdataPublicacao&cpfCnpj=${cpfj}&ordenarPor=nome&direcao=asc`);
					}

				}

				browser.runtime.sendMessage({ action: "open", url: urls });
			}
		},

		{
			action: "consultar-user-sei",
			icon: "icon-user-sei",
			title: "Consultar Usuário Externo",
			condition: function (e) { return !testFieldNames($(e.currentTarget).closest('.proc-field').attr('field-name'), /\bfistel\b/i) && validateFistel($(this).text()) },
			callback: async function (e) {

				let cpf = $(this).text().replace(/\D/g, "");

				waitMessage(`Consultando Usuário Externo SEI para o CPF nº ${cpfjReadable(cpf)}...`);
				consultarUsuarioExterno(cpf).then(data => {
					if (data.status == "ok") infoMessage(`Usuário Externo SEI **VÁLIDO!**\n\n@@**Nome:** ${data.nome}\n**E-mail:** ${data.email}@@\n`);
					else errorMessage(`Usuário Externo SEI **INVÁLIDO!**\n\n@@**Nome:** ${data.nome}\n**Situação:** ${data.status}@@\n`);
				}).catch(error => {
					errorMessage(error.message);
				}).finally(() => { waitMessage() });


			}
		},


		{
			action: "consultar-extrato",
			icon: "icon-search",
			title: "Consultar Extrato",
			condition: function (e) { return testFieldNames($(e.currentTarget).closest('.proc-field').attr('field-name'), /\bfistel\b|\bfistel_principal\b|\boutorga\b/i) && validateFistel($(this).text()) },
			callback: function (e) {
				let fistel = $(this).text().replace(/\D/g, "");
				browser.runtime.sendMessage({ action: "open", url: `http://sistemasnet/sigec/ConsultasGerais/ExtratoLancamentos/tela.asp?NumFistel=${fistel}&tipolancamento=todos&acao=c&hdnImprimir=true` });
			}
		},


		{
			action: "consultar-indicativo",
			icon: "icon-search",
			title: "Consultar Indicativo",
			condition: function (e) { return testFieldNames($(e.currentTarget).closest('.proc-field').attr('field-name'), /\bindicativo\b/i) && $(this).text().match(/\s*\w[\w\d-]\s*/i) },
			callback: async function (e) {
				let indicativo = $(this).text().trim();
				let servico = $('#hdnServico').val();
				waitMessage("Preparando consulta...");

				try {
					let url = await consultarUrlServico(servico, indicativo);
					browser.runtime.sendMessage({ action: "open", url: url });
					waitMessage();
				} catch (err) {
					waitMessage();
					errorMessage(err);
				}
			}
		},

		{
			action: "consultar-anac",
			icon: "icon-anac",
			title: "Consultar ANAC",
			condition: function (e) { return testFieldNames($(e.currentTarget).closest('.proc-field').attr('field-name'), /\bindicativo\b/i) && $('#hdnServico').val() == "507" && $(this).text().match(/\s*P[PRSTU][A-Z]{3}\s*/i) },
			callback: async function (e) {
				let indicativo = $(this).text().trim();
				waitMessage("Abrindo sistemas da ANAC...");


				try {
					browser.runtime.sendMessage({
						action: "open", url: "https://sistemas.anac.gov.br/SACI/SIAC/Aeronave/Estacao/Consulta.asp", script: `
													sessionStorage.predata_siac = JSON.stringify({indicativo: "${indicativo}", timestamp: Date.now()});
													/*var marca = document.querySelector('input[name=txtMarca]');
													if (marca) {
														sessionStorage.removeItem("predata_siac");
														marca.value = "${indicativo}";
														var form = document.querySelector('form[name=frmAeronave]');
														if (form) form.submit();
													}*/`, runAt: "document_start"
					});
					waitMessage();
				} catch (err) {
					waitMessage();
					errorMessage(err);
				}
			}
		},

		{
			action: "cpag",
			icon: "icon-coin",
			title: "Controle de Pagto",
			condition: function (e) { return testFieldNames($(e.currentTarget).closest('.proc-field').attr('field-name'), /\bfistel\b|\bfistel_principal\b|\boutorga\b/i) && validateFistel($(this).text()) },
			callback: function (e) {
				let fistel = $(this).text().replace(/\D/g, "");
				confirmMessage(`Incluir controle de pagamento para o Fistel **${fistel}**?`).then(() => {
					let info = getCurrentProcInfo();
					addControlePagto(fistel, info.processo, info.codServico, true, info.nome);
				});
			}
		}];


	$(items).unactionable().actionable({ actions: actions, copyMsgClassName: "msgGeral msgSucesso" });
}

//Atualizar campos no painel do processo corrente
function updateFieldsPanel(fields) {
	if (doc = getFrameDocument("arvore")) {
		let $panel = $(doc).find('#panelDetails');

		$panel.find('.proc-field').remove();
		let last_p = $panel.find('p:contains("Interessado:"):last').get(0) || $panel.find('p:contains("Interessados:"):last').get(0) || $panel.find('p:last').get(0);

		if (fields) {
			fields.sort((a, b) => { return identityNormalize(a.name) - identityNormalize(b.name) });
			fields.forEach((f) => { $(last_p).before($(`<p class="proc-field" field-name="${identityNormalize(f.name)}"><label>${f.name}: </label><span class='actionable'>${f.value}</span></p>`)) });
		}

		applyActionPanel('.proc-field span');

		$panel.get(0).removeCommand("icon-refresh");
	}
}

function parseNoteTags(content) {
	if (!content) return content;

	content = content.trim();
	content = content.replace(/UMI:(.*?);/i, '<span class="umi-tag" title="Último Movimento do Interessado (UMI)">$1</span>');
	content = content.replace(/PPC:(.*?);/i, '<span class="ppc-tag" title="Próximo Ponto de Controle (PPC)">$1</span>');

	return content;
}


//Atualizar conteúdo do painel de anotações na árvore do processo
function updateNotesPanel(content) {
	if (doc = getFrameDocument("arvore")) {
		content = parseNoteTags(content);



		if (content) $(doc).find('#panelNotes').css("display", "block").find('span').html(content.replace(/\n/g, "<br>"));
		else $(doc).find('#panelNotes').css("display", "none");
	}
}


//Carregar página interna da extensão
async function loadInternalPage(dest, src, title) {
	src = await Promise.resolve($.ajax({ url: browser.runtime.getURL(src), dataType: "text" }));
	var text;
	src = src.replace(/<link\s+href=["']extension:\/\/(.*\.css)["']\s*\/>/ig, (m0, m1) => {
		$.ajax({ url: browser.runtime.getURL(m1), dataType: "text", async: false }).done(data => { text = data });
		return `<style type="text/css">${text}</style>\n`;
	});

	src = src.replace(/<script\s+src=["']extension:\/\/(.*\.js)["']\s*\/>/ig, (m0, m1) => {
		$.ajax({ url: browser.runtime.getURL(m1), dataType: "text", async: false }).done(data => text = data);
		return `<script type="text/javascript">${text}</script>\n`;
	});

	$(dest).html(src);
	if (title) $(document).find('title').text(title);

}


//Criar URL para serviços cfor
function getCforUrl(path) {
	var cfor_address = "https://10.51.10.200" + (location.hostname.match(/seihm/i) ? ":444" : "");
	if (path) return cfor_address + "/" + path;
	return cfor_address;
}


//Tocar som de notificação
function soundNotification() {
	var audio = new Audio();
	audio.src = browser.runtime.getURL("assets/notify.opus");
	audio.play();
}


//Exibir notificação
function notify(action, msg) {
	waitMessage(null);

	if (!msg) {
		msg = action;
		action = null;
	}

	action = action == "success" || action == "fail" ? "-" + action : "";

	browser.runtime.sendMessage({ action: `notify${action}`, content: msg });

	return action === "success";
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