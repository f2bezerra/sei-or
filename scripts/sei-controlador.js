/**
* @file Script de interação com o controlador do SEI
* @author Fábio Fernandes Bezerra
* @copyright f2bezerra 2024
* @license MIT
*/

$(() => {
	//Controle de Lotação
	// var lotacao = getCurrentLotacao();
	// if (lotacao && !("GR05|GR05OR|GR05AF|CBC2".includes(lotacao))) {
	// 	if (!document.baseURI.match(/controlador\.php\?acao=infra_configurar&.*/i)) {
	// 		if (anchor = top.window.document.getElementById('lnkConfiguracaoSistema')) {
	// 			browser.runtime.sendMessage({action: "navigate", url: absoluteUrl($(anchor).attr("href")), script: undefined});			
	// 			return;				
	// 		} else window.close();
	// 	} else {
	// 		$('#divInfraAreaTelaD').html(`
	// 			<h1 class="infraBarraLocalizacao"><img src="${browser.runtime.getURL('assets/logo-24.png')}"> Aviso Importante!</h1>
	// 			<h2>A extensão "cfor-ext" está habilitada apenas para as lotações <strong style="font-weight: 700;">GR05OR e GR05AF</strong>. <br><br> Altere sua lotação "${lotacao}" ou desinstale a extensão!</h2>
	// 		`);
	// 	}
	// }


	// //Controle de Versão
	// const CURRENT_NEWS = 3.3;

	// if (!localStorage.cfor_lastnews || localStorage.cfor_lastnews < CURRENT_NEWS) {
	// 	if (!$(top.window.document.body).find("#btn_cfornews").length) {
	// 		let $btn_news  = $(`<a id="btn_cfornews" class="cbtn-pulse cbtn-pulse-red cbtn-floating" title="Notas da Atualização ${browser.runtime.getManifest().version}"><img style="vertical-align: middle; margin: 0; transform: scale(0.87);"></a>`);
	// 		$btn_news.find('img').attr("src", browser.runtime.getURL("assets/logo-24w.png"));
	// 		$(top.window.document.body).append($btn_news);

	// 		$btn_news.click(e => {

	// 			$.ajax({url: browser.runtime.getURL("doc/version_notes.md"), dataType: "text"}).done(content => {
	// 				let version = browser.runtime.getManifest().version;
	// 				popupMessage("@@" + content + "@@", "Notas da Atualização  " + version);
	// 			});

	// 			$btn_news.remove();
	// 			localStorage.cfor_lastnews = CURRENT_NEWS;
	// 		});
	// 	}
	// }


	// //Atalhos gerais para o SEI
	//  let keyDownHandler = function (e) {
	// 	if (e.ctrlKey && e.key == "Enter" && (btnSalvar = $(':submit[value=Salvar]').get(0) || 
	// 													  $(':button[value="Confirmar Dados"]').get(0) || 
	// 													  $(':button[value="Salvar"]').get(0) ||
	// 													  $('button:contains(Salvar)').get(0))) {
	// 		e.preventDefault();
	// 		e.stopPropagation();
	// 		for (var i = 0; i < top.window.parent.frames.length; i++) top.window.parent.frames[i].document.removeEventListener('keydown', keyDownHandler);
	// 		$(btnSalvar).trigger("click");
	// 	}

	// 	if (e.ctrlKey && e.shiftKey && e.key == "L") {
	// 		e.preventDefault();
	// 		e.stopPropagation();
	// 		openFormDlg([{id: "content", type: "textarea", placeholder: "Texto a ser copiado para a área de transferência", cols: 50, rows: 2}], "Copiar Conteúdo", {icon: "modal-dlg-icon-copy", confirmButton: "Copiar"}).then(data => {
	// 			setClipboard(data.content);
	// 		});
	// 	}


	// };

	// for (var i = 0; i < top.window.parent.frames.length; i++) top.window.parent.frames[i].document.addEventListener('keydown', keyDownHandler, true);
	// top.window.addEventListener('keydown', keyDownHandler, true);


	//Criar opção no Menu Principal do SEI	
	/* 	if (main_menu = top.window.document.getElementById("main-menu"))  {
			
			if (!$(main_menu).find('#link-cpag').get(0)) {
					$(main_menu).append('<li><a id="link-cpag" href="#" title="CPAG">Controle de Pagamento</a></li>');
					$(main_menu).find('#link-cpag').click(e => {
						var $tela = $(top.window.document.body).find('#divInfraAreaTelaD');
						loadInternalPage($tela, "cpag/cpag.html", "SEI - Controle de Pagamento");
					});
			}
			
		} */

});