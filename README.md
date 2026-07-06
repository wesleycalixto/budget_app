# Gerador de Orçamentos

Sistema para criar, salvar e visualizar orçamentos, com layout baseado no template de tecnologia & segurança.

## Estrutura do projeto

```
orcamento-app/
├── index.html      # Estrutura da página
├── css/
│   └── style.css   # Estilos (cores, layout, tipografia, impressão)
├── js/
│   └── app.js      # Lógica da aplicação (formulário, cálculo, storage, PDF)
└── README.md
```

## Como usar

Abra `index.html` em um navegador. Não é necessário servidor nem instalação.

## Observação sobre armazenamento

Este projeto foi originalmente construído para rodar dentro do ambiente de artifacts do Claude.ai, que fornece uma API própria de armazenamento persistente (`window.storage`) em vez do `localStorage` do navegador (não suportado nesse ambiente).

Se for rodar fora do Claude.ai (localmente, em um servidor próprio, etc.), abra `js/app.js` e troque o objeto `Store` no topo do arquivo para usar `localStorage` ou `IndexedDB`, por exemplo:

```js
const Store = {
  async getQuotes(){
    const v = localStorage.getItem('orcamentos:list');
    return v ? JSON.parse(v) : [];
  },
  async saveQuotes(list){
    localStorage.setItem('orcamentos:list', JSON.stringify(list));
  },
  async getConfig(){
    const v = localStorage.getItem('orcamentos:config');
    return v ? JSON.parse(v) : null;
  },
  async saveConfig(cfg){
    localStorage.setItem('orcamentos:config', JSON.stringify(cfg));
  }
};
```

O restante do código (formulário, cálculo de totais, geração do PDF via impressão do navegador, upload de logo) funciona igual em qualquer ambiente.
