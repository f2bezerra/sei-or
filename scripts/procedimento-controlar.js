/**
* @file Script de interação com o controlador de processos do SEI
* @author Fábio Fernandes Bezerra
* @copyright f2bezerra 2024
* @license MIT
*/

var tables = {
	"Recebidos": localStorage.filterSettingsRecebidos ?? null,
	"Gerados": localStorage.filterSettingsGerados ?? null,
	"Detalhado": localStorage.filterSettingsDetalhado ?? null
};

$(() => {

	for (let table in tables) {
		tables[table] = tables[table] ? JSON.parse(tables[table]) : { reaplicar: false };

		let lastFiltroTabela = sessionStorage["filtroTabela" + table] ?? '';

		if (tables[table].reaplicar && lastFiltroTabela) filterTable(table, lastFiltroTabela, tables[table].despaginar ?? true);
		else lastFiltroTabela = sessionStorage["filtroTabela" + table] = '';

		createTableFilter(table, { ...tables[table], filtro: lastFiltroTabela });
	}

});

async function handleNextPontoControle(e) {
	let selectedRows = $('tr:visible .infraCheckboxInput:checked').closest('tr').get();

	if (!selectedRows.length) return errorMessage('Nenhum processo foi selecionado!');

	let rowsBySituacao = {};

	selectedRows.forEach(row => {

		if (row.situacao == undefined) {
			let situacao = $(row).find('a[href*="acao=andamento_situacao"]').attr("onmouseover");
			row.situacao = situacao && (m = situacao.match(/['"]([^'"]+)/)) ? m[1] : null;
		}

		if (row.situacao) {
			if (rowsBySituacao[row.situacao] == undefined) rowsBySituacao[row.situacao] = 1;
			else rowsBySituacao[row.situacao] += 1;
		}

	})

	let filteredSelectedRows = selectedRows.filter(row => row.situacao);

	let msg;

	if (!filteredSelectedRows.length) {
		msg = selectedRows.length > 1 ?
			`Nenhum dos ${selectedRows.length} processos selecionados está em um Ponto de Controle!` :
			`O processo ${$(selectedRows[0]).find('a[href*="acao=procedimento_trabalhar"]').text()} não está em nenhum Ponto de Controle!`;

		return errorMessage(msg);
	}

	msg = (selectedRows.length > 1 && selectedRows.length > filteredSelectedRows.length) ?
		`@@Dos ${selectedRows.length} processos selecionados, apenas ${filteredSelectedRows.length == 1 ? 'o' : filteredSelectedRows.length} ` :
		(filteredSelectedRows.length == 1 ? 'O ' : '@@Todos os processos selecionados ');

	if (filteredSelectedRows.length == 1) {
		msg += `processo ${$(filteredSelectedRows[0]).find('a[href*="acao=procedimento_trabalhar"]').text()} está no Ponto de Controle <<${filteredSelectedRows[0].situacao}>>.\n`;
	} else if (Object.getOwnPropertyNames(rowsBySituacao).length == 1) {
		msg += `estão no Ponto de Controle <<${filteredSelectedRows[0].situacao}>>.\n`;
	} else {
		msg += `estão num Ponto de Controle.<ul style="text-align:left;">`;

		for (let situacao in rowsBySituacao) {
			let plural = rowsBySituacao[situacao] > 1;
			msg += `<li>${rowsBySituacao[situacao]} processo${plural ? 's' : ''}`;
			msg += ` est${plural ? 'ão' : 'á'} no Ponto de Controle <<${situacao}>></li>`;
		}
		msg += "</ul>";
	}

	msg += "Clique em Confirmar para continuar."

	if (! await confirmMessage(msg, { cancelButton: 'Cancelar', confirmButton: 'Confirmar' })) return;

	setTimeout(() => {
		for (row of filteredSelectedRows) {

		}


	}, 100);
}

async function unpageTables() {
	let pages = {};
	let maxPages = 0;

	for (let table in tables) {

		let ctrlPaginacao = table == "Detalhado" ? "Infra" : table;

		if (!document.getElementById("div" + ctrlPaginacao + "AreaPaginacaoSuperior")) {
			pages[table] = 0;
			continue;
		}

		pages[table] = $(`#sel${ctrlPaginacao}PaginacaoSuperior option`).length;
		if (!pages[table]) pages[table] = 2;

		maxPages = Math.max(maxPages, pages[table]);
	}

	if (!maxPages) return;

	waitMessage('Despaginando tabelas...');

	let pagePromises = [];

	for (let page = 0; page < maxPages; page++) {
		let dataPost = {};
		let updateTableParams = {};
		for (let table in tables) {
			let ctrlPaginacao = table == "Detalhado" ? "Infra" : table;

			let currentPage = Number($("#hdn" + ctrlPaginacao + "PaginaAtual").val());
			if (page < pages[table] && page != currentPage) {
				dataPost["hdn" + ctrlPaginacao + "PaginaAtual"] = page;
				updateTableParams[table] = { page: page, activePage: currentPage, begin: document.querySelector(`#tblProcessos${table} tbody tr:nth-child(2)`) };
			}
		}

		pagePromises.push(postFormData("#frmProcedimentoControlar", { returnParams: updateTableParams, data: dataPost }));
	}

	return Promise.allSettled(pagePromises).then(results => {
		const parser = new DOMParser();
		results.filter(result => result.status == 'fulfilled').forEach(result => {
			let doc = parser.parseFromString(result.value.response, "text/html");

			for (let table in result.value.params) {

				let rows = doc.querySelectorAll(`#tblProcessos${table} tbody tr:nth-child(n+2)`);

				let oldItens = $(`#hdn${table}Itens`).val();
				let newItens = Array.from(rows).map(row => row.id.replace(/\D/g, '')).join(",");

				if (result.value.params[table].page > result.value.params[table].activePage) {
					$(`#tblProcessos${table} tbody`).append(rows);
					$(`#hdn${table}Itens`).val(oldItens + "," + newItens);
				} else {
					$(rows).insertBefore(result.value.params[table].begin);
					$(`#hdn${table}Itens`).val(newItens + "," + oldItens);
				}

				$(`#hdn${table}NroItens`).val(Number($(`#hdn${table}NroItens`).val()) + rows.length);
			}
		});

		for (let table in tables) {
			let ctrlPaginacao = table == "Detalhado" ? "Infra" : table;

			$(`#tblProcessos${table}`).find('[type=checkbox]').each((index, check) => {
				check.id = "chk" + table + "Item" + index;
				let label = check.nextElementSibling;

				if ($(check).is('.infraCheckbox')) $(check).addClass("infraCheckboxInput").wrap('<div class="infraCheckboxDiv"></div>');

				if (label) $(label).attr("for", check.id)
				else $(check).after(`<label class="infraCheckboxLabel" for="${check.id}" title="${check.title}"></label>`);
			});

			$(`#div${ctrlPaginacao}AreaPaginacaoSuperior, #div${ctrlPaginacao}AreaPaginacaoInferior`).remove();

			let tblProcessos = document.getElementById("tblProcessos" + table);
			if (tblProcessos) tblProcessos.unpaged = true;
		}

		$('.infraCaption').each((index, caption) => {
			let text = $(caption).text();
			$(caption).text((m = text.match(/\d+\s+registros?/i)) ? m[0] : text);
		});

		$('#divComandos').remove();
		$('a[item-id=despaginar]').closest('li').remove();

		waitMessage(null);
	});

}

async function updateTable(table, unpage) {
	let tblProcessos = document.getElementById("tblProcessos" + table);
	if (tblProcessos.updated && (!unpage || tblProcessos.unpaged)) return;

	if (unpage) await unpageTables();

	let $rows = $(`#tblProcessos${table} tbody tr:gt(0)`).each((index, row) => {

		let situacao = $(row).find('a[href*="acao=andamento_situacao"]').attr("onmouseover");
		row.situacao = situacao && (m = situacao.match(/['"]([^'"]+)/)) ? m[1] : null;

		let prazo = $(row).find('a[href*="acao=controle_prazo"]').attr("onmouseover");
		row.prazo = prazo && (m = prazo.match(/\d\d\/\d\d\/\d{4}/)) ? m[0].toDate() : Number.MAX_VALUE;
	}).detach().sort((a, b) => a.prazo - b.prazo);

	$(`#tblProcessos${table} tbody`).append($rows);
	tblProcessos.updated = true;
}

async function filterTable(table, filter, unpage) {

	if (filter) await updateTable(table, unpage);

	$(`#tblProcessos${table}>tbody>tr:gt(0)`).filter((index, row) => {
		$(row).toggle(!filter || row.situacao == filter);
	});

	if (filter) $(`#tblProcessos${table} .infraCaption`).attr("data-before", "Filtrado " + $(`#tblProcessos${table}>tbody>tr:gt(0):visible`).length + "  de ");
	else $(`#tblProcessos${table} .infraCaption`).removeAttr("data-before");

	sessionStorage["filtroTabela" + table] = filter;
}

async function createTableFilter(table, filterSettings) {
	let tableFilter = document.getElementById(`tblProcessos${table}Filter`);

	if (!tableFilter) {
		let lastTableHeader = document.querySelector(`#tblProcessos${table} th:last-child`)
		if (!lastTableHeader) return;

		lastTableHeader.insertAdjacentHTML('afterend', `
			<th class="infraTh" width="5%">
				<a href="javascript:void(0);" id="tblProcessos${table}Filter" tabindex="1002" title="Filtrar Tabela">
					<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="16px" height="16px" viewBox="0 0 971.986 971.986" xml:space="preserve" stroke="#ffffff" fill="#ffffff">
						<g>
							<path d="M370.216,459.3c10.2,11.1,15.8,25.6,15.8,40.6v442c0,26.601,32.1,40.101,51.1,21.4l123.3-141.3 c16.5-19.8,25.6-29.601,25.6-49.2V500c0-15,5.7-29.5,15.8-40.601L955.615,75.5c26.5-28.8,6.101-75.5-33.1-75.5h-873 c-39.2,0-59.7,46.6-33.1,75.5L370.216,459.3z"></path>
						</g>
					</svg>
				</a>
			</th>
		`);

		let filtros = [];
		filtros.push("-Ponto de Controle:-");
		filtros.push({ key: "filtro", text: "Nenhum", value: "" });
		filtros.push("-");

		let pontosControle = PontoControle.list();
		pontosControle.forEach(ponto => filtros.push({ id: "filtro", key: "filtro", text: ponto.name }));

		filtros.push("-");

		let configs = [];
		configs.push({ id: "despaginar", text: "Despaginar tabelas" });
		configs.push({ id: "reaplicar", key: "reaplicar", text: "Reaplicar último filtro", value: true });


		filtros.push({ text: "Configuração", items: configs });

		createPopupMenu(`tblProcessos${table}Filter`, filtros, { useTextAsValue: true, value: filterSettings }, e => {
			switch (e.id) {
				case 'filtro':
					filterTable(table, e.value, tables[table].despaginar);
					break;

				case 'despaginar':
					let lastFiltroTabela = sessionStorage["filtroTabela" + table] ?? '';
					if (lastFiltroTabela) filterTable(table, lastFiltroTabela, true);
					else unpageTables();

					break;

				case 'reaplicar':
					tables[table].reaplicar = e.value == 'true';
					localStorage.setItem('filterSettings' + table, JSON.stringify(tables[table]));

					break;
			}
		});
	}
}
