/**
* @file Script de interação com a pagina d etrabalho do processo
* @author Fábio Fernandes Bezerra
* @copyright f2bezerra 2024
* @license MIT
*/

(async function init() {

	await waitDocumentReady(document);
	let docArvore = await waitDocumentReady("#ifrArvore");

	var pontoControle = getPontoControleInfo(docArvore);
	pontoControle = pontoControle && PontoControle.fromName(pontoControle.name, pontoControle.link);

	if (pontoControle) {

		if (pontoControle.reject) addCommand("btnRejectPC",
			pontoControle.reject.icon ?? "extension://images/reject-pc.svg",
			pontoControle.reject.desc ?? "Voltar Ponto de Controle", null, e => pontoControle.doReject(docArvore, true)
		);


		if (pontoControle.resolve) addCommand("btnResolvePC",
			pontoControle.resolve.icon ?? "extension://images/resolve-pc.svg",
			pontoControle.resolve.desc ?? "Avançar Ponto de Controle", null, e => pontoControle.doResolve(docArvore, true)
		);

	}

})();