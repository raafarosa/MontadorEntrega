(function () {
    const tiposConhecidos = [
        "Site Web", "Web Service", "Arquivo Local", "Executável", 
        "Linha de Comando", "Linha Comando", "Plugin", "Plug-in", 
        "Relatorio SIC", "Web API", "Serviço", "Monitor Arquivos"
    ];

    function processarDadosBrutos(textoBruto) {
        if (!textoBruto || !textoBruto.trim()) return [];

        // 1. Unificação inicial de quebras de linha normais
        let textoContinuo = textoBruto
            .replace(/\r?\n|\r/g, ' ')
            .replace(/\s+/g, ' ');

        // 2. Limpeza profunda de cabeçalhos de páginas do PDF
        textoContinuo = textoContinuo.replace(/Ficha de Entrega Consolidada\s*-\s*Sub-Projeto:\s*\d+\s+\d+\s*\/\s*\d+/gi, '');
        textoContinuo = textoContinuo.replace(/Ficha de Entrega Consolidada\s*-\s*Projeto:\s*\d+\s+\d+\s*\/\s*\d+/gi, '');
        textoContinuo = textoContinuo.replace(/Cli\.?\s+Sist\.?\s+Inst\.?\s+Executável\/WebSite\/Arquivo\s+Local\s+Atualiz\.\s+Versão\s+Release\s+Plataforma\s+Dt\.\s+Atualiz\.?/gi, '');
        textoContinuo = textoContinuo.replace(/Executáveis liberados:/gi, '');
        textoContinuo = textoContinuo.replace(/Descrição da Implementação:/gi, '');
        textoContinuo = textoContinuo.replace(/V\.a\s+Executáveis,\s+WebSites\s+e\s+arquivos/gi, '');

        // 3. Captura dos blocos principais baseada estritamente na trinca numérica (Cli Sist Inst)
        const regexBlocos = /(\b\d{3})\s+(\d{2,3})\s+(\d{4,5}(?:\s+\d{1,2})?)\s+(.*?)(?=\b\d{3}\s+\d{2,3}\s+\d{4,5}|$)/gi;
        
        let registros = [];
        let match;

        while ((match = regexBlocos.exec(textoContinuo)) !== null) {
            let cli = match[1];
            let sist = match[2];
            let inst = match[3];
            let miolo = match[4] ? match[4].trim() : "";

            if (!miolo) continue;

            // Extrai Data/Hora do bloco
            let dataHora = "";
            const regexData = /\b\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}:\d{2})?/i;
            let matchData = miolo.match(regexData);
            if (matchData) {
                dataHora = matchData[0];
                miolo = miolo.replace(regexData, '').trim();
            }

            // Identifica qual o Tipo da aplicação que está contido no miolo
            let tipoIdentificado = "-";
            for (let t of tiposConhecidos) {
                let regexT = new RegExp("\\b" + t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "\\b", "i");
                if (regexT.test(miolo)) {
                    tipoIdentificado = t;
                    break;
                }
            }

            let nomeExecutavel = miolo;
            let sobraDados = "";

            if (tipoIdentificado !== "-") {
                let regexSplitTipo = new RegExp("\\b" + tipoIdentificado.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "\\b", "i");
                let partes = miolo.split(regexSplitTipo);
                
                let antesDoTipo = partes[0].trim();
                let depoisDoTipo = partes.slice(1).join(' ').trim();

                let matchVersao = depoisDoTipo.match(/\b\d{6,7}\b/);
                if (matchVersao) {
                    let indexVersao = depoisDoTipo.indexOf(matchVersao[0]);
                    let complementoNome = depoisDoTipo.substring(0, indexVersao).trim();
                    
                    if (antesDoTipo === "") {
                        nomeExecutavel = `${tipoIdentificado} ${complementoNome}`.trim();
                    } else {
                        nomeExecutavel = `${antesDoTipo} ${tipoIdentificado} ${complementoNome}`.trim();
                    }
                    sobraDados = depoisDoTipo.substring(indexVersao).trim();
                } else {
                    nomeExecutavel = antesDoTipo ? `${antesDoTipo} ${tipoIdentificado}` : tipoIdentificado;
                    sobraDados = depoisDoTipo;
                }
            } else {
                let matchVersaoFallback = miolo.match(/(.*?)\b(\d{6,7})\b/);
                if (matchVersaoFallback) {
                    nomeExecutavel = matchVersaoFallback[1].trim();
                    sobraDados = miolo.substring(matchVersaoFallback[1].length).trim();
                }
            }

            // --- HIGIENIZAÇÃO RIGOROSA DE NOMES ---
            tiposConhecidos.forEach(t => {
                let regexRemoverFim = new RegExp("\\s+" + t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i");
                nomeExecutavel = nomeExecutavel.replace(regexRemoverFim, "").trim();
            });

            nomeExecutavel = nomeExecutavel.replace(/\s+/g, ' ').trim();

            // Extração estrutural de Versão, Release e Plataforma
            const numVersoes = sobraDados.match(/\b\d{6,7}\b/g) || [];
            let versao = numVersoes[0] || "-";
            let release = numVersoes[1] || "-";

            let plataforma = sobraDados;
            if (versao !== "-") plataforma = plataforma.replace(versao, '');
            if (release !== "-") plataforma = plataforma.replace(release, '');
            plataforma = plataforma.replace(/\s+/g, ' ').trim();
            if (!plataforma) plataforma = "-";

            let chaveUnica = `${cli}_${sist}_${inst}_${versao}`.replace(/\s+/g, '');

            registros.push({
                chave: chaveUnica,
                cli: cli,
                sist: sist,
                inst: inst,
                nome: nomeExecutavel,
                tipo: tipoIdentificado,
                versao: versao,
                release: release,
                plataforma: plataforma,
                data: dataHora,
                stringSimples: `${nomeExecutavel}${versao !== "-" ? " - " + versao : ""}${release !== "-" ? " | R" + release : ""}`
            });
        }

        return registros;
    }

    function obterSaudacao() {
        const agora = new Date();
        const hora = agora.getHours();
        return hora < 12 ? "Prezados, bom dia." : "Prezados, boa tarde.";
    }

    function salvarEstadoCheckbox(chave, checado) {
        let estados = JSON.parse(localStorage.getItem('montador_checklist_estado')) || {};
        estados[chave] = checado;
        localStorage.setItem('montador_checklist_estado', JSON.stringify(estados));
    }

    function carregarEstadoCheckbox(chave) {
        let estados = JSON.parse(localStorage.getItem('montador_checklist_estado')) || {};
        return !!estados[chave];
    }

    function gerarEmailETabela() {
        try {
            const nomePacote = document.getElementById('nomePacote').value.trim() || '[NOME_DO_PACOTE_FALANDO]';
            const infoPersonalizada = document.getElementById('infoPersonalizada').value.trim() || '[INFORMAÇÃO_PERSONALIZADA]';
            const textoBruto = document.getElementById('textoBruto').value;

            localStorage.setItem('montador_nomePacote', nomePacote);
            localStorage.setItem('montador_infoPersonalizada', infoPersonalizada);
            localStorage.setItem('montador_textoBruto', textoBruto);

            const itensProcessados = processarDadosBrutos(textoBruto);
            
            let listaEmail = '';
            if (itensProcessados.length > 0) {
                listaEmail = itensProcessados.map(item => `     • ${item.stringSimples}`).join('\n');
            } else {
                listaEmail = '     • [Nenhuma aplicação detectada - Verifique o formato de entrada]';
            }

            const saudacaoDinamica = obterSaudacao();

            const emailTemplate = `${saudacaoDinamica}
 
Disponibilizamos via ftp o pacote ${nomePacote}, que contempla a ${infoPersonalizada}. No pacote temos:
 
Documentações
     • Testes do CQ
     • Ficha de entrega atualizada 
 
Aplicações
${listaEmail}`;

            document.getElementById('resultado').innerText = emailTemplate;

            const corpoTabela = document.getElementById('corpoTabela');
            corpoTabela.innerHTML = ""; 

            if (itensProcessados.length > 0) {
                itensProcessados.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.id = "row_" + item.chave;
                    
                    const estaChecado = carregarEstadoCheckbox(item.chave);
                    if (estaChecado) {
                        tr.classList.add('linha-checada');
                    }

                    tr.innerHTML = `
                        <td>${item.cli}</td>
                        <td>${item.sist}</td>
                        <td>${item.inst}</td>
                        <td style="font-weight: 500; color: #fff;">${item.nome}</td>
                        <td><span class="badge-tipo">${item.tipo}</span></td>
                        <td style="color: #10b981; font-weight: bold;">${item.versao}</td>
                        <td style="color: #f59e0b;">${item.release}</td>
                        <td>${item.plataforma}</td>
                        <td style="white-space: nowrap; font-family: monospace;">${item.data}</td>
                        <td style="text-align: center;">
                            <input type="checkbox" class="chk-status" data-chave="${item.chave}" ${estaChecado ? 'checked' : ''}>
                        </td>
                    `;
                    corpoTabela.appendChild(tr);
                });

                document.querySelectorAll('.chk-status').forEach(chk => {
                    chk.addEventListener('change', function() {
                        const chave = this.getAttribute('data-chave');
                        const linea = document.getElementById("row_" + chave);
                        if (this.checked) {
                            linea.classList.add('linha-checada');
                            salvarEstadoCheckbox(chave, true);
                        } else {
                            linea.classList.remove('linha-checada');
                            salvarEstadoCheckbox(chave, false);
                        }
                    });
                });

            } else {
                corpoTabela.innerHTML = `<tr><td colspan="10" style="text-align:center; color:#ef4444; padding:20px;">Nenhum executável parseado. Certifique-se de colar os dados no padrão do PDF consolidado.</td></tr>`;
            }

            document.getElementById('resultadoContainer').style.display = 'block';
        } catch (err) {
            console.error(err);
            alert('Ocorreu um erro ao processar os dados.');
        }
    }

    async function copiarTexto() {
        const texto = document.getElementById('resultado').innerText;
        if (!texto) return;

        try {
            await navigator.clipboard.writeText(texto);
            alert('E-mail copiado com sucesso!');
        } catch (error) {
            const areaTexto = document.createElement('textarea');
            areaTexto.value = texto;
            document.body.appendChild(areaTexto);
            areaTexto.select();
            document.execCommand('copy');
            document.body.removeChild(areaTexto);
            alert('E-mail copiado com sucesso!');
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        const sNome = localStorage.getItem('montador_nomePacote');
        const sInfo = localStorage.getItem('montador_infoPersonalizada');
        const sTexto = localStorage.getItem('montador_textoBruto');

        if (sNome) document.getElementById('nomePacote').value = sNome;
        if (sInfo) document.getElementById('infoPersonalizada').value = sInfo;
        if (sTexto) {
            document.getElementById('textoBruto').value = sTexto;
            gerarEmailETabela();
        }
    });

    document.getElementById('btnGerar').addEventListener('click', gerarEmailETabela);
    document.getElementById('btnCopiar').addEventListener('click', copiarTexto);
})();