/**
 * Configurações Gerais — Sistema de Devoluções Makita do Brasil
 */

export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyADzX4-bDgcs17ugEJ9XFtiT5oJRs_Y-aQ",
    authDomain: "makita-devolucoes.firebaseapp.com",
    projectId: "makita-devolucoes",
    storageBucket: "makita-devolucoes.appspot.com"
};

// URL do Google Apps Script Web App (Desativado em favor da sincronização direta via Firestore)
export const GOOGLE_APPS_SCRIPT_URL = "";

// Administradores do sistema com acesso ao painel de importação/gestão
export const ADMIN_EMAILS = [
    "j_melgaco@makita.com.br"
];

// Vínculo E-mail -> Dados Protheus (fallback local caso Firestore esteja indisponível)
export const VINCULOS_INICIAIS = {
    "j_melgaco@makita.com.br":         { protheus: "88901", nome: "Jonathan Melgaço",               cargo: "Coordenador de Trade Marketing", filial: "01 - Matriz", isAdmin: true  },
    "b_espindula@makita.com.br":       { protheus: "22371", nome: "Bruno de Fonseca Espindula",     cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "c_farias@makita.com.br":          { protheus: "16214", nome: "Cleissa Barreto Farias",         cargo: "Promotora Técnica",              filial: "01 - Matriz", isAdmin: false },
    "d_nobrega@makita.com.br":         { protheus: "20712", nome: "Daniel Andrade Nóbrega",         cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "d_fernandes@makita.com.br":       { protheus: "22776", nome: "Davi Lopes Fernandes",           cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "denilson_silva@makita.com.br":    { protheus: "7163",  nome: "Denilson Lima Silva",            cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "diego_costa@makita.com.br":       { protheus: "7167",  nome: "Diego da Silva Costa",           cargo: "Analista De Produtos Técnico",   filial: "01 - Matriz", isAdmin: false },
    "d_maia@makita.com.br":            { protheus: "20138", nome: "Diego da Cruz Maia",             cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "d_fortes@makita.com.br":          { protheus: "21932", nome: "Douglas Fortes",                 cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "d_costa@makita.com.br":           { protheus: "19845", nome: "Douglas Henrique de Jesus Costa",cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "em_santos@makita.com.br":         { protheus: "21762", nome: "Eder Matheus Martins Santos",    cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "er_souza@makitabr.onmicrosoft.com":{ protheus: "17378",nome: "Erisvan de Sousa",               cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "em_neto@makita.com.br":           { protheus: "21970", nome: "Ernandes Martins Tavares Neto",  cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "t_montenegro@makita.com.br":      { protheus: "16422", nome: "Felipe da Silva Montenegro",     cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "fr_santos@makita.com.br":         { protheus: "21935", nome: "Felipe Remenegildo dos Santos",  cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "fv_oliveira@makita.com.br":       { protheus: "17380", nome: "Felipe Vilas Boas de Oliveira",  cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "fc_costa@makita.com.br":          { protheus: "16347", nome: "Fernando Costa de Oliveira",     cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "fe_pereira@makita.com.br":        { protheus: "13556", nome: "Fernando Pereira da Silva",      cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "f_castro@makita.com.br":          { protheus: "22531", nome: "Fred Silva Castro",              cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "hcesar@makita.com.br":            { protheus: "9679",  nome: "Hermes César da Silva",          cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "h_alves@makita.com.br":           { protheus: "14982", nome: "Hiago Leonel do Carmo Alves",    cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "hizidio@makita.com.br":           { protheus: "9199",  nome: "Humberto Izídio de Lima",        cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "i_silva@makita.com.br":           { protheus: "22153", nome: "Igor Luciano da Silva",          cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "j_herculino@makita.com.br":       { protheus: "19459", nome: "Jhony Willrobson Herculino",     cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "j_figueiredo@makita.com.br":      { protheus: "22533", nome: "João Henrique M. de Figueiredo", cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "t_viti@makita.com.br":            { protheus: "22775", nome: "Thiago Teixeira Viti",           cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "jc_silva@makita.com.br":          { protheus: "13555", nome: "Julio Cesar de Souza Silva",     cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "k_araujo@makita.com.br":          { protheus: "21863", nome: "Keven Alves de Araujo",          cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "map_santos@makita.com.br":        { protheus: "21933", nome: "Marcelo Pereira Santos",         cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "mo_souza@makita.com.br":          { protheus: "21930", nome: "Marco Orelio Schtine de Souza",  cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "mv_souza@makita.com.br":          { protheus: "21446", nome: "Marcos Vinícius Torquarto",      cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "m_ladario@makita.com.br":         { protheus: "18342", nome: "Matheus Ramos Ladário",          cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "r_sousa@makita.com.br":           { protheus: "13557", nome: "Rodrigo Pereira de Souza",       cargo: "Analista De Produtos Técnico",   filial: "01 - Matriz", isAdmin: false },
    "r_lima@makita.com.br":            { protheus: "12460", nome: "Rogério Soares Guimaraes Lima",  cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "s_monteiro@makita.com.br":        { protheus: "22532", nome: "Samuel Jonathas de Lima Monteiro",cargo: "Promotor Técnico",              filial: "01 - Matriz", isAdmin: false },
    "s_mendes@makita.com.br":          { protheus: "22372", nome: "Sebastião Manuel Mendes",        cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "s_correia@makita.com.br":         { protheus: "15087", nome: "Sérgio Luiz da Silva Correia",   cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "s_oliveira@makita.com.br":        { protheus: "12983", nome: "Sérgio Sena de Oliveira",        cargo: "Analista De Produtos Técnico",   filial: "01 - Matriz", isAdmin: false },
    "v_silva@makita.com.br":           { protheus: "22154", nome: "Vagner Doria Silva",             cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "v_jardim@makita.com.br":          { protheus: "22155", nome: "Vagner Machado Jardim",          cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "v_duarte@makita.com.br":          { protheus: "15624", nome: "Vitor Araujo Duarte",            cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "w_sodre@makita.com.br":           { protheus: "21186", nome: "Webeson da Silva Sodré",         cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "l_francisco@makita.com.br":       { protheus: "",      nome: "Leandro de Souza Francisco",     cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
    "e_machado@makita.com.br":         { protheus: "22942", nome: "Eduardo de Souza Machado",       cargo: "Promotor Técnico",               filial: "01 - Matriz", isAdmin: false },
};

// Base simulada vazia (Todos os dados devem obrigatoriamente vir do Firebase Firestore)
export const MOCK_ATIVOS_PROTHEUS = {};

// Lista das principais filiais Braspress para auxílio e autocomplete

// Lista das principais filiais Braspress para auxílio e autocomplete
export const FILIAIS_BRASPRESS = [
    { uf: "SP", cidade: "São Paulo - Matriz/Vila Maria", endereco: "Rua do Rocio, 100 - Vila Maria" },
    { uf: "SP", cidade: "Campinas", endereco: "Rodovia Anhanguera, km 98" },
    { uf: "SP", cidade: "Ribeirão Preto", endereco: "Av. Brasil, 2500" },
    { uf: "SP", cidade: "São Bernardo do Campo (ABC)", endereco: "Av. Rotary, 800" },
    { uf: "SP", cidade: "São José dos Campos", endereco: "Av. Nelson D'Ávila, 1200" },
    { uf: "RJ", cidade: "Rio de Janeiro - Pavuna", endereco: "Rod. Pres. Dutra, km 163" },
    { uf: "MG", cidade: "Belo Horizonte / Contagem", endereco: "Av. Babita Camargos, 1100" },
    { uf: "PR", cidade: "Curitiba / São José dos Pinhais", endereco: "BR-376, km 15" },
    { uf: "RS", cidade: "Porto Alegre / Canoas", endereco: "BR-116, km 268" },
    { uf: "SC", cidade: "Joinville", endereco: "Rua Dona Francisca, 8300" },
    { uf: "BA", cidade: "Salvador / Simões Filho", endereco: "Via Urbana, 500" },
    { uf: "PE", cidade: "Recife / Jaboatão", endereco: "BR-101 Sul, km 82" },
    { uf: "CE", cidade: "Fortaleza", endereco: "BR-116, km 7" },
    { uf: "GO", cidade: "Goiânia / Aparecida", endereco: "Av. Rio Verde, 1400" },
    { uf: "DF", cidade: "Brasília / SIA", endereco: "SIA Trecho 3, Lote 620" }
];
