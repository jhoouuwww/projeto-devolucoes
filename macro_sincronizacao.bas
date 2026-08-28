Attribute VB_Name = "ModuloSincronizacaoFirebase"
' ==============================================================================
' Modulo de Sincronizacao Firebase Firestore — Makita do Brasil
' ==============================================================================
' Este modulo contem a macro principal e funcoes auxiliares para ler a planilha
' de Notas Fiscais pendentes e sincroniza-las diretamente com o Firestore
' utilizando a API REST do Google.
' ==============================================================================

Option Explicit

' Configurações Parametrizadas (Altere se necessário)
Private Const FIREBASE_API_KEY As String = "AIzaSyADzX4-bDgcs17ugEJ9XFtiT5oJRs_Y-aQ"
Private Const PROJECT_ID As String = "makita-devolucoes"
Private Const COLECAO_ALVO As String = "nfe_disponiveis"

' Credenciais fixas de administrador (Evita a necessidade de digitação pelo usuário)
Private Const ADMIN_EMAIL As String = "j_melgaco@makita.com.br"
Private Const ADMIN_PASS As String = "J-onathan18"

' Mapeamento de Colunas (Ajuste de acordo com a sua planilha)
Private Const COL_NFE As String = "A"          ' Coluna contendo o Número da NFe
Private Const COL_PROTHEUS As String = "B"     ' Coluna contendo o Código Protheus do promotor
Private Const COL_CLIENTE As String = "C"      ' Coluna contendo o Nome do Cliente
Private Const COL_DATA As String = "D"         ' Coluna contendo a Data de Emissão

''' <summary>
''' Macro principal que realiza a leitura da planilha, mapeamento de usuarios,
''' autenticação no Firebase e envio dos dados via API REST.
''' </summary>
Public Sub SincronizarFirebase()
    Dim ws As Worksheet
    Dim lastRow As Long
    Dim i As Long
    Dim numNfe As String
    Dim codProtheus As String
    Dim nomeCliente As String
    Dim dataEmissaoRaw As Variant
    Dim dataEmissaoISO As String
    Dim emailUsuario As String
    
    Dim mapUsuarios As Object
    Dim idToken As String
    Dim erroMsg As String
    Dim jsonPayload As String
    Dim urlPatch As String
    Dim responseText As String
    Dim statusHTTP As Long
    Dim totalEnviadas As Long
    Dim totalIgnoradas As Long
    
    ' Configura a planilha ativa
    Set ws = ActiveSheet
    
    ' Identifica a última linha preenchida com base na coluna de Notas Fiscais
    lastRow = ws.Cells(ws.Rows.Count, COL_NFE).End(xlUp).Row
    If lastRow < 2 Then
        MsgBox "Nenhum dado encontrado na planilha (linha de cabeçalho apenas ou vazia).", vbExclamation, "Erro"
        Exit Sub
    End If
    
    ' 1. Mapeamento de Usuários (Código Protheus -> E-mail Corporativo)
    Set mapUsuarios = CreateObject("Scripting.Dictionary")
    mapUsuarios.Add "12460", "r_soares@makita.com.br"
    mapUsuarios.Add "12345", "j_dias@makita.com.br"
    mapUsuarios.Add "88901", "j_melgaco@makita.com.br"
    mapUsuarios.Add "45012", "fernando_gomes@makita.com.br"
    mapUsuarios.Add "45013", "s_oliveira@makita.com.br"
    mapUsuarios.Add "45014", "r_sousa@makita.com.br"
    mapUsuarios.Add "45015", "diego_costa@makita.com.br"
    
    ' 2. Obter Token JWT (idToken) do Firebase Auth usando as credenciais fixas
    Application.StatusBar = "Autenticando no Firebase..."
    idToken = ObterIdTokenFirebase(FIREBASE_API_KEY, ADMIN_EMAIL, ADMIN_PASS, erroMsg)
    
    If idToken = "" Then
        Application.StatusBar = ""
        MsgBox "Falha de Autenticação!" & vbCrLf & erroMsg, vbCritical, "Erro de Conexão"
        Exit Sub
    End If
    
    totalEnviadas = 0
    totalIgnoradas = 0
    
    ' Desativa atualização de tela para ganho de performance no loop
    Application.ScreenUpdating = False
    
    ' 3. Varredura e iteração sobre as linhas da planilha
    For i = 2 To lastRow ' Assume que a linha 1 contem os cabeçalhos
        
        ' Extração e limpeza dos dados
        numNfe = LimparString(ws.Cells(i, COL_NFE).Value)
        codProtheus = LimparString(ws.Cells(i, COL_PROTHEUS).Value)
        nomeCliente = Trim(ws.Cells(i, COL_CLIENTE).Value)
        dataEmissaoRaw = ws.Cells(i, COL_DATA).Value
        
        ' Pula linhas que não contêm dados essenciais básicos
        If numNfe = "" Or codProtheus = "" Then
            totalIgnoradas = totalIgnoradas + 1
            GoTo ProximaLinha
        End If
        
        ' Cruzamento com dicionário de usuários
        If mapUsuarios.Exists(codProtheus) Then
            emailUsuario = mapUsuarios.Item(codProtheus)
        Else
            ' Ignora/descarte as linhas que não possuírem e-mail mapeado
            totalIgnoradas = totalIgnoradas + 1
            GoTo ProximaLinha
        End If
        
        ' Formatação da data de emissão para ISO 8601 (padrão Firestore REST)
        dataEmissaoISO = FormatarDataISO(dataEmissaoRaw)
        
        ' Montagem do Payload JSON (estrutura typed do Firestore)
        jsonPayload = CriarJsonFirestore(numNfe, nomeCliente, codProtheus, emailUsuario, dataEmissaoISO)
        
        ' URL do Documento no Firestore (utiliza o Número da NFe como ID do Documento)
        urlPatch = "https://firestore.googleapis.com/v1/projects/" & PROJECT_ID & _
                   "/databases/(default)/documents/" & COLECAO_ALVO & "/" & numNfe & _
                   "?updateMask.fieldPaths=numeroNfe" & _
                   "&updateMask.fieldPaths=nomeCliente" & _
                   "&updateMask.fieldPaths=codigoProtheus" & _
                   "&updateMask.fieldPaths=emailUsuario" & _
                   "&updateMask.fieldPaths=dataEmissao"
                   
        ' Realiza o envio via PATCH (Upsert)
        Application.StatusBar = "Enviando NFe " & numNfe & " (" & i & " de " & lastRow & ")..."
        Call EnviarRequisicaoHTTP("PATCH", urlPatch, jsonPayload, idToken, statusHTTP, responseText)
        
        If statusHTTP = 200 Then
            totalEnviadas = totalEnviadas + 1
        Else
            ' Trata eventuais falhas individuais de gravação
            Application.ScreenUpdating = True
            Application.StatusBar = ""
            MsgBox "Falha ao enviar a NFe " & numNfe & " (Erro HTTP " & statusHTTP & ")." & vbCrLf & _
                   "Retorno do servidor: " & responseText, vbCritical, "Erro de Gravação"
            Exit Sub
        End If

ProximaLinha:
    Next i
    
    ' Restaura as configurações do Excel
    Application.ScreenUpdating = True
    Application.StatusBar = ""
    
    ' Exibe resumo final da operação
    MsgBox "Sincronização concluída com sucesso!" & vbCrLf & _
           "- Notas enviadas/atualizadas: " & totalEnviadas & vbCrLf & _
           "- Linhas ignoradas/sem e-mail: " & totalIgnoradas, vbInformation, "Fim da Execução"
End Sub

' ==============================================================================
' FUNÇÕES AUXILIARES MODULARES
' ==============================================================================

''' <summary>
''' Obtem o token JWT de autenticação do Firebase usando Login e Senha.
''' </summary>
Private Function ObterIdTokenFirebase(apiKey As String, email As String, password As String, ByRef erroMsg As String) As String
    Dim xmlHttp As Object
    Dim url As String
    Dim payload As String
    Dim responseText As String
    Dim status As Long
    
    On Error GoTo TratarErro
    
    Set xmlHttp = CreateObject("MSXML2.XMLHTTP")
    url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" & apiKey
    
    ' Payload JSON para autenticação
    payload = "{""email"":""" & email & """,""password"":""" & password & """,""returnSecureToken"":true}"
    
    xmlHttp.Open "POST", url, False
    xmlHttp.setRequestHeader "Content-Type", "application/json"
    xmlHttp.Send payload
    
    responseText = xmlHttp.responseText
    status = xmlHttp.Status
    
    If status = 200 Then
        ' Extração do token JWT do JSON de resposta (InStr para evitar dependência de biblioteca JSON)
        Dim startPos As Long
        Dim endPos As Long
        Dim keyStr As String
        keyStr = """idToken"": """
        
        startPos = InStr(responseText, keyStr)
        If startPos > 0 Then
            startPos = startPos + Len(keyStr)
            endPos = InStr(startPos, responseText, """")
            ObterIdTokenFirebase = Mid(responseText, startPos, endPos - startPos)
            Exit Function
        End If
    End If
    
    erroMsg = "Resposta do servidor (" & status & "): " & responseText
    ObterIdTokenFirebase = ""
    Exit Function

TratarErro:
    erroMsg = "Erro de conexão: " & Err.Description
    ObterIdTokenFirebase = ""
End Function

''' <summary>
''' Envia requisições HTTP para a API REST do Firestore.
''' </summary>
Private Sub EnviarRequisicaoHTTP(metodo As String, url As String, payload As String, token As String, ByRef outStatus As Long, ByRef outResponse As String)
    Dim xmlHttp As Object
    
    On Error GoTo TratarErro
    
    Set xmlHttp = CreateObject("MSXML2.XMLHTTP")
    xmlHttp.Open metodo, url, False
    
    xmlHttp.setRequestHeader "Content-Type", "application/json"
    xmlHttp.setRequestHeader "Authorization", "Bearer " & token
    
    xmlHttp.Send payload
    
    outStatus = xmlHttp.Status
    outResponse = xmlHttp.responseText
    Exit Sub

TratarErro:
    outStatus = 0
    outResponse = Err.Description
End Sub

''' <summary>
''' Monta a estrutura JSON formatada requerida pela API REST do Firestore (typed fields).
''' </summary>
Private Function CriarJsonFirestore(numeroNfe As String, nomeCliente As String, codigoProtheus As String, emailUsuario As String, dataEmissao As String) As String
    Dim json As String
    
    json = "{"
    json = json & """fields"": {"
    json = json & "  ""numeroNfe"": {""stringValue"": """ & EscapeJSON(numeroNfe) & """},"
    json = json & "  ""nomeCliente"": {""stringValue"": """ & EscapeJSON(nomeCliente) & """},"
    json = json & "  ""codigoProtheus"": {""stringValue"": """ & EscapeJSON(codigoProtheus) & """},"
    json = json & "  ""emailUsuario"": {""stringValue"": """ & EscapeJSON(emailUsuario) & """}"
    
    ' Se houver data, insere o campo com formato Timestamp do Firestore
    If dataEmissao <> "" Then
        json = json & ",  ""dataEmissao"": {""timestampValue"": """ & dataEmissao & """}"
    End If
    
    json = json & "}"
    json = json & "}"
    
    CriarJsonFirestore = json
End Function

''' <summary>
''' Trata quebras de linha, aspas e barras para evitar JSON corrompido.
''' </summary>
Private Function EscapeJSON(val As String) As String
    Dim res As String
    res = Replace(val, "\", "\\")
    res = Replace(res, """", "\""")
    res = Replace(res, vbCrLf, "\n")
    res = Replace(res, vbCr, "\n")
    res = Replace(res, vbLf, "\n")
    EscapeJSON = res
End Function

''' <summary>
''' Formata a data vinda da célula do Excel para o formato ISO 8601 exigido pelo Firebase.
''' </summary>
Private Function FormatarDataISO(dataCell As Variant) As String
    If IsDate(dataCell) Then
        FormatarDataISO = Format(dataCell, "yyyy-mm-dd") & "T00:00:00Z"
    Else
        FormatarDataISO = ""
    End If
End Function

''' <summary>
''' Remove decimais (.0) e espaços extras caso números tenham sido interpretados como floats.
''' </summary>
Private Function LimparString(val As Variant) As String
    Dim s As String
    s = Trim(CStr(val))
    If Right(s, 2) = ".0" Then
        s = Left(s, Len(s) - 2)
    End If
    LimparString = s
End Function
