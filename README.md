# Sistema de Devoluções — Makita do Brasil

Sistema interno para gestão e condução de solicitações de devolução de máquinas e ativos de colaboradores/promotores da Makita do Brasil.

---

## 📄 Especificação e System Message
A especificação completa das diretrizes, regras de negócio, restrições e comportamento do assistente/fluxo está disponível em:
- [system-message-sistema-devolucoes.md](./system-message-sistema-devolucoes.md)

---

## 🛠️ Stack Tecnológica e Arquitetura

- **Frontend / Hosting:** HTML/JS/CSS hospedado no **Firebase Hosting**.
- **Autenticação:** **Firebase Authentication** com restrição para e-mails corporativos `@makita.com.br`.
- **Banco de Dados (Firestore):**
  - Coleção de vínculo `usuarios_protheus` (e-mail corporativo $\rightarrow$ código Protheus).
  - Coleção de `solicitacoes_devolucao` (armazenamento das solicitações confirmadas).
- **Integração em Tempo Real:** **Google Apps Script (Web App)** atuando como ponte/API sem custos (plano Spark do Firebase), consultando a planilha dinâmica alimentada pelo Protheus por código de usuário.
- **Processo Fiscal:** Condução manual externa (CC-e e NF-e) a partir dos registros gerados.
