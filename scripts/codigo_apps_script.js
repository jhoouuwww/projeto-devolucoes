/**
 * GOOGLE APPS SCRIPT — WEB APP DE CONSULTA DE ATIVOS PROTHEUS
 * =========================================================================
 * Cole este código no editor de scripts da sua planilha Google Sheets:
 * (Extensões > Apps Script > Substitua o código e clique em Implantar > Nova Implantação > App da Web)
 * 
 * Configuração da Implantação:
 * - Executar como: "Eu"
 * - Quem tem acesso: "Qualquer pessoa" (ou restrito ao domínio Makita)
 */

function doGet(e) {
  try {
    var protheus = e.parameter.protheus;
    var action = e.parameter.action || "buscar_ativos";

    if (!protheus) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "erro",
        mensagem: "Parâmetro 'protheus' é obrigatório."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Consulta") || ss.getActiveSheet();

    // 1. Insere o código Protheus nas células B1 e B2 (conforme o padrão da empresa)
    sheet.getRange("B1").setValue(protheus);
    sheet.getRange("B2").setValue(protheus);

    // 2. Força a atualização imediata das fórmulas dinâmicas da planilha
    SpreadsheetApp.flush();
    Utilities.sleep(500); // Pausa de 500ms para recálculo de fórmulas complexas

    // 3. Lê os dados resultantes a partir da linha 4
    var lastRow = sheet.getLastRow();
    if (lastRow < 4) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "sucesso",
        protheus: protheus,
        itens: []
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Lê até a coluna 6 (Código, Descrição, NF, Pedido, Saldo, Série)
    var range = sheet.getRange(4, 1, lastRow - 3, 6);
    var values = range.getValues();

    var itens = [];
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var codigo = String(row[0] || "").trim();
      var descricao = String(row[1] || "").trim();
      var nf = String(row[2] || "").trim();
      var pedido = String(row[3] || "").trim();
      var saldo = parseInt(row[4], 10) || 1;
      var serie = String(row[5] || "").trim();

      if (codigo && descricao) {
        itens.push({
          id: "item_" + (i + 1),
          codigoItem: codigo,
          descricao: descricao,
          notaFiscal: nf || "S/NF",
          pedido: pedido || "S/PED",
          saldoDisponivel: saldo,
          numeroSerie: serie
        });
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "sucesso",
      protheus: protheus,
      total: itens.length,
      itens: itens
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "erro",
      mensagem: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
