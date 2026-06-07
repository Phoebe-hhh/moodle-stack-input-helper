(function() {
    const pluginUrl = (path) => {
        return window.location.origin + '/local/stackinputhelper/' + path;
    };

    const replaceLegacyNodeUrl = (url, fallback) => {
        if (!url || /:3001\b/.test(url) || /\/mobile\/[A-Za-z0-9]+/.test(url)) {
            return fallback;
        }
        return url;
    };

    const config = Object.assign({
        recognizeUrl: '',
        convertUrl: '',
        sessionCreateUrl: '',
        sessionResultUrl: '',
        sesskey: '',
        enablemobile: true,
        uploadbtn: 'Upload math image',
        mobilebtn: 'Mobile Math Upload',
        uploading: 'Recognizing...',
        recognizefailed: 'Recognition failed.',
        recognizedresults: 'Recognized results',
        selectanswer: 'Select the answer to insert into STACK:',
        recommendedanswer: 'Recommended answer',
        stackpreview: 'STACK input preview:',
        insertanswer: 'Insert answer',
        rawlatex: 'Raw LaTeX',
        lineprefix: 'Line',
        creatingmobilesession: 'Creating mobile upload session...',
        waitingmobileupload: 'Waiting for mobile upload...',
        mobileuploadreceived: 'Successfully received mobile result. You can upload another photo with the same QR code.',
        mobileuploadexpired: 'This mobile upload session has expired.',
        mobileuploadtimeout: 'Timeout waiting for result. Please create a new session.',
        mobilesessionfailed: 'Failed to create mobile session:',
        partialselectionfailed: 'Could not convert the selected text.'
    }, window.STACKINPUTHELPER_CONFIG || {});

    config.recognizeUrl = replaceLegacyNodeUrl(config.recognizeUrl || config.apiurl, pluginUrl('recognize.php'));
    config.convertUrl = replaceLegacyNodeUrl(config.convertUrl, pluginUrl('convert.php'));
    config.sessionCreateUrl = replaceLegacyNodeUrl(config.sessionCreateUrl, pluginUrl('session_create.php'));
    config.sessionResultUrl = replaceLegacyNodeUrl(config.sessionResultUrl || config.sessionResultBaseUrl, pluginUrl('session_result.php'));
    config.sesskey = config.sesskey || (window.M && M.cfg && M.cfg.sesskey) || '';

    const findAnswerBoxes = () => {
        const selectors = [
            'input[data-stack-input-type]',
            'textarea[data-stack-input-type]',
            'input[data-stack-input-decimalseparator]',
            'textarea[data-stack-input-decimalseparator]'
        ];

        const boxes = [];
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                if (el.offsetParent !== null && !boxes.includes(el)) {
                    boxes.push(el);
                }
            });
        });
        return boxes;
    };

    const createHiddenFileInput = () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.setAttribute('capture', 'environment');
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        return fileInput;
    };

    const setAnswerValue = (input, value) => {
        input.focus();
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const postImage = async (url, file, extra = {}) => {
        if (!url) {
            throw new Error('Recognition endpoint is not configured.');
        }

        const formData = new FormData();
        formData.append('image', file);
        formData.append('sesskey', config.sesskey);
        Object.keys(extra).forEach(key => formData.append(key, extra[key]));

        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || ('HTTP ' + response.status));
        }

        return data;
    };

    const postLatex = async (latex) => {
        if (!config.convertUrl) {
            throw new Error('Conversion endpoint is not configured.');
        }

        const formData = new FormData();
        formData.append('latex', latex);
        formData.append('sesskey', config.sesskey);

        const response = await fetch(config.convertUrl, {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || ('HTTP ' + response.status));
        }

        return data.stack || '';
    };

    const createTextarea = (value, readonly) => {
        const ta = document.createElement('textarea');
        ta.value = value || '';
        ta.readOnly = readonly;
        ta.rows = 2;
        ta.style.width = '100%';
        ta.style.boxSizing = 'border-box';
        ta.style.marginTop = '4px';
        ta.style.marginBottom = '8px';
        ta.style.fontSize = '13px';
        ta.style.fontFamily = 'monospace';
        return ta;
    };

    const createResultPanel = () => {
        const panel = document.createElement('div');
        const choiceName = 'local-stackinputhelper-line-choice-' + Math.random().toString(36).slice(2);
        panel.style.marginTop = '8px';
        panel.style.padding = '8px';
        panel.style.border = '1px solid #ddd';
        panel.style.background = '#fafafa';
        panel.style.display = 'none';
        panel.style.maxWidth = '720px';

        const title = document.createElement('div');
        title.textContent = config.recognizedresults || 'Recognized results';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '4px';

        const instruction = document.createElement('div');
        instruction.textContent = config.selectanswer || 'Select the answer to insert into STACK:';
        instruction.style.marginBottom = '8px';

        const options = document.createElement('div');
        options.style.display = 'grid';
        options.style.gap = '6px';
        options.style.marginBottom = '8px';

        const rawDetails = document.createElement('details');
        rawDetails.style.marginBottom = '8px';
        const rawSummary = document.createElement('summary');
        rawSummary.textContent = config.rawlatex || 'Raw LaTeX';
        rawSummary.style.cursor = 'pointer';
        const rawTextarea = createTextarea('', true);
        rawDetails.appendChild(rawSummary);
        rawDetails.appendChild(rawTextarea);

        const stackTitle = document.createElement('label');
        stackTitle.textContent = config.stackpreview || 'STACK input preview:';
        stackTitle.style.display = 'block';
        stackTitle.style.fontWeight = 'bold';
        const stackTextarea = createTextarea('', false);
        const stackTextareaId = 'local-stackinputhelper-stack-preview-' + Math.random().toString(36).slice(2);
        stackTextarea.id = stackTextareaId;
        stackTitle.setAttribute('for', stackTextareaId);

        const applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.textContent = config.insertanswer || 'Insert answer';
        applyBtn.style.padding = '4px 8px';
        applyBtn.style.cursor = 'pointer';

        panel.appendChild(title);
        panel.appendChild(instruction);
        panel.appendChild(options);
        panel.appendChild(rawDetails);
        panel.appendChild(stackTitle);
        panel.appendChild(stackTextarea);
        panel.appendChild(applyBtn);

        panel._options = options;
        panel._rawTextarea = rawTextarea;
        panel._stackTextarea = stackTextarea;
        panel._applyBtn = applyBtn;
        panel._choiceName = choiceName;

        return panel;
    };

    const createMobilePanel = () => {
        const panel = document.createElement('div');
        panel.style.marginTop = '8px';
        panel.style.padding = '8px';
        panel.style.border = '1px solid #ddd';
        panel.style.background = '#f8fbff';
        panel.style.display = 'none';

        const title = document.createElement('div');
        title.textContent = config.mobilebtn || 'Mobile Math Upload';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '8px';

        const tip = document.createElement('div');
        tip.textContent = 'Scan the QR code with your phone, log in if needed, and upload the image.';
        tip.style.marginBottom = '8px';

        const qrImg = document.createElement('img');
        qrImg.style.display = 'block';
        qrImg.style.maxWidth = '220px';
        qrImg.style.border = '1px solid #ddd';
        qrImg.style.marginBottom = '8px';

        const link = document.createElement('a');
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.wordBreak = 'break-all';
        link.style.display = 'block';
        link.style.marginBottom = '8px';

        const warning = document.createElement('div');
        warning.style.display = 'none';
        warning.style.marginBottom = '8px';
        warning.style.padding = '8px';
        warning.style.border = '1px solid #f0ad4e';
        warning.style.background = '#fff8e5';
        warning.style.color = '#6b4b00';

        const status = document.createElement('div');
        status.textContent = 'Session not created';
        status.style.color = '#555';

        panel.appendChild(title);
        panel.appendChild(tip);
        panel.appendChild(qrImg);
        panel.appendChild(link);
        panel.appendChild(warning);
        panel.appendChild(status);

        panel._qrImg = qrImg;
        panel._link = link;
        panel._warning = warning;
        panel._status = status;
        return panel;
    };

    const escapeHtml = (value) => {
        return String(value || '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    };

    const renderLatex = (latex) => {
        const value = String(latex || '').trim();
        return value ? '\\(' + escapeHtml(value) + '\\)' : '';
    };

    const typesetMath = (element) => {
        if (!window.MathJax || !element) {
            return;
        }

        if (typeof window.MathJax.typesetPromise === 'function') {
            window.MathJax.typesetPromise([element]).catch(error => {
                window.console.warn('[stackinputhelper] MathJax typeset failed:', error);
            });
            return;
        }

        if (window.MathJax.Hub && typeof window.MathJax.Hub.Queue === 'function') {
            window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub, element]);
        }
    };

    const normalizeResultLines = (rawLatex, stackResult, lines) => {
        if (Array.isArray(lines) && lines.length) {
            const lastIndex = lines.length - 1;
            return lines.map((line, index) => ({
                latex: String(line.latex || '').trim(),
                display: String(line.display || line.latex || '').trim(),
                displayParts: Array.isArray(line.display_parts) ? line.display_parts : [],
                math: String(line.math || '').trim(),
                stack: String(line.stack || line.text || '').trim(),
                recommended: index === lastIndex
            })).filter(line => line.latex || line.stack);
        }

        const latex = String(rawLatex || stackResult || '').trim();
        const stack = String(stackResult || latex || '').trim();
        return latex || stack ? [{ latex, stack, recommended: true }] : [];
    };

    const selectionInside = (selection, container) => {
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            return false;
        }

        const range = selection.getRangeAt(0);
        return container.contains(range.commonAncestorContainer);
    };

    const normalizeSelectableText = (value) => {
        return String(value || '')
            .replace(/[−–—]/g, '-')
            .replace(/\s+/g, '')
            .trim();
    };

    const latexDisplayMap = (latex) => {
        const source = String(latex || '');
        const chars = [];
        const starts = [];
        const ends = [];

        for (let i = 0; i < source.length; i++) {
            const char = source[i];
            if (/\s/.test(char) || char === '&') {
                continue;
            }

            if (char === '\\') {
                const match = source.slice(i).match(/^\\[a-zA-Z]+/);
                if (match) {
                    const command = match[0];
                    if (command === '\\cdot' || command === '\\times') {
                        chars.push('*');
                        starts.push(i);
                        ends.push(i + command.length);
                    }
                    i += command.length - 1;
                    continue;
                }
            }

            if (char === '^') {
                const start = i;
                if (source[i + 1] === '{') {
                    let depth = 1;
                    let j = i + 2;
                    while (j < source.length && depth > 0) {
                        if (source[j] === '{') {
                            depth++;
                        } else if (source[j] === '}') {
                            depth--;
                        }
                        j++;
                    }
                    const exponent = source.slice(i + 2, j - 1).replace(/\s+/g, '');
                    for (const expchar of exponent) {
                        chars.push(expchar);
                        starts.push(start);
                        ends.push(j);
                    }
                    i = j - 1;
                    continue;
                }

                if (source[i + 1]) {
                    chars.push(source[i + 1]);
                    starts.push(start);
                    ends.push(i + 2);
                    i++;
                }
                continue;
            }

            if (char === '{' || char === '}') {
                continue;
            }

            chars.push(char);
            starts.push(i);
            ends.push(i + 1);
        }

        return { text: chars.join(''), starts, ends, source };
    };

    const selectedLatexFromLine = (selectedText, latex) => {
        const normalized = normalizeSelectableText(selectedText);
        if (!normalized) {
            return '';
        }

        const mapped = latexDisplayMap(latex);
        const start = normalizeSelectableText(mapped.text).indexOf(normalized);
        if (start === -1) {
            return '';
        }

        const end = start + normalized.length - 1;
        const sourceStart = mapped.starts[start];
        const sourceEnd = mapped.ends[end];
        return mapped.source.slice(sourceStart, sourceEnd).trim();
    };

    const readSelectedLatex = (container) => {
        const selection = window.getSelection ? window.getSelection() : null;
        if (!selectionInside(selection, container)) {
            return '';
        }

        const range = selection.getRangeAt(0);
        const selectedText = selection.toString().replace(/\s+/g, ' ').trim();
        const mathNodes = Array.from(container.querySelectorAll('[data-latex]')).filter(node => {
            return typeof range.intersectsNode === 'function' && range.intersectsNode(node);
        });

        if (mathNodes.length === 1) {
            const latex = selectedLatexFromLine(selectedText, mathNodes[0].dataset.latex || '');
            if (latex) {
                return latex;
            }
        }

        return selectedText;
    };

    const clientSideStackFallback = (value) => {
        let stack = String(value || '').trim();
        if (!stack) {
            return '';
        }

        stack = stack.replace(/[−–—]/g, '-');
        stack = stack.replace(/[𝑥𝒙𝓍]/g, 'x');
        stack = stack.replace(/[𝑦𝒚𝓎]/g, 'y');
        stack = stack.replace(/[𝑧𝒛𝓏]/g, 'z');
        stack = stack.replace(/[²]/g, '^2');
        stack = stack.replace(/[³]/g, '^3');
        stack = stack.replace(/[⁴]/g, '^4');
        stack = stack.replace(/[⁵]/g, '^5');
        stack = stack.replace(/[⁶]/g, '^6');
        stack = stack.replace(/[⁷]/g, '^7');
        stack = stack.replace(/[⁸]/g, '^8');
        stack = stack.replace(/[⁹]/g, '^9');
        stack = stack.replace(/[⁰]/g, '^0');
        stack = stack.replace(/\\cdot|\\times/g, '*');
        stack = stack.replace(/\^\{([^{}]+)\}/g, '^$1');
        stack = stack.replace(/[{}]/g, '');
        stack = stack.replace(/\s+/g, '');
        stack = stack.replace(/(\d)([A-Za-z])/g, '$1*$2');
        stack = stack.replace(/\)([A-Za-z])/g, ')*$1');
        stack = stack.replace(/([A-Za-z])\(/g, '$1*(');

        return stack;
    };

    const superscriptDisplay = (value) => {
        const superscripts = {
            '0': '⁰',
            '1': '¹',
            '2': '²',
            '3': '³',
            '4': '⁴',
            '5': '⁵',
            '6': '⁶',
            '7': '⁷',
            '8': '⁸',
            '9': '⁹',
            '+': '⁺',
            '-': '⁻'
        };

        return String(value || '').split('').map(char => superscripts[char] || char).join('');
    };

    const parseLatexGroup = (source, start) => {
        let i = start;
        while (/\s/.test(source[i] || '')) {
            i++;
        }
        if (source[i] !== '{') {
            return null;
        }

        let depth = 1;
        let j = i + 1;
        while (j < source.length && depth > 0) {
            if (source[j] === '{') {
                depth++;
            } else if (source[j] === '}') {
                depth--;
            }
            j++;
        }
        if (depth !== 0) {
            return null;
        }

        return {
            value: source.slice(i + 1, j - 1).trim(),
            end: j
        };
    };

    const parseLatexFraction = (source, start) => {
        const numerator = parseLatexGroup(source, start);
        if (!numerator) {
            return null;
        }
        const denominator = parseLatexGroup(source, numerator.end);
        if (!denominator) {
            return null;
        }

        return {
            numerator: numerator.value,
            denominator: denominator.value,
            end: denominator.end
        };
    };

    const latexTokens = (latex) => {
        const source = String(latex || '');
        const tokens = [];

        for (let i = 0; i < source.length; i++) {
            const char = source[i];
            if (/\s/.test(char) || char === '&') {
                continue;
            }

            if (char === '\\') {
                const match = source.slice(i).match(/^\\[a-zA-Z]+/);
                if (match) {
                    const command = match[0];
                    if (command === '\\frac') {
                        const parsed = parseLatexFraction(source, i + command.length);
                        if (parsed) {
                            tokens.push({
                                latex: source.slice(i, parsed.end),
                                display: '(' + parsed.numerator + ')/(' + parsed.denominator + ')'
                            });
                            i = parsed.end - 1;
                            continue;
                        }
                    }
                    tokens.push({
                        latex: command,
                        display: command === '\\cdot' || command === '\\times' ? '*' :
                            command === '\\pi' ? 'π' : command.replace(/^\\/, '')
                    });
                    i += command.length - 1;
                    continue;
                }
            }

            if (char === '^') {
                if (source[i + 1] === '{') {
                    let depth = 1;
                    let j = i + 2;
                    while (j < source.length && depth > 0) {
                        if (source[j] === '{') {
                            depth++;
                        } else if (source[j] === '}') {
                            depth--;
                        }
                        j++;
                    }
                    const exponent = source.slice(i + 2, j - 1).replace(/\s+/g, '');
                    tokens.push({
                        latex: '^{' + exponent + '}',
                        display: superscriptDisplay(exponent)
                    });
                    i = j - 1;
                    continue;
                }

                if (source[i + 1]) {
                    tokens.push({
                        latex: '^' + source[i + 1],
                        display: superscriptDisplay(source[i + 1])
                    });
                    i++;
                }
                continue;
            }

            if (char === '{' || char === '}') {
                continue;
            }

            tokens.push({ latex: char, display: char });
        }

        return tokens;
    };

    const convertSelectedLatex = async (panel, latex) => {
        const fallback = clientSideStackFallback(latex);
        panel._stackTextarea.value = fallback || latex;

        try {
            const stack = await postLatex(latex);
            panel._stackTextarea.value = stack || fallback || latex;
        } catch (error) {
            window.console.warn('[stackinputhelper] partial selection conversion failed:', error);
            panel._stackTextarea.value = fallback || latex;
        }
    };

    const selectTokenRange = (row, start, end) => {
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        row.querySelectorAll('[data-token-index]').forEach(token => {
            const index = Number(token.dataset.tokenIndex);
            token.style.background = index >= min && index <= max ? '#cfe3ff' : '';
        });

        row._selectionStart = min;
        row._selectionEnd = max;
    };

    const clearTokenSelections = (panel, exceptRow = null) => {
        (panel._tokenRows || []).forEach(row => {
            if (row === exceptRow) {
                return;
            }
            row.querySelectorAll('[data-token-index]').forEach(token => {
                token.style.background = '';
            });
            row._selectionStart = null;
            row._selectionEnd = null;
            row._dragging = false;
        });
    };

    const createTokenSelector = (panel, latex) => {
        const tokens = latexTokens(latex);
        if (!tokens.length) {
            return null;
        }

        const row = document.createElement('span');
        row.style.display = 'inline-flex';
        row.style.flexWrap = 'wrap';
        row.style.alignItems = 'baseline';
        row.style.gap = '2px';
        row.style.marginTop = '0';
        row.style.padding = '2px 0';
        row.style.fontFamily = 'serif';
        row.style.fontSize = '20px';
        row.style.userSelect = 'none';
        row._tokens = tokens;
        panel._tokenRows = panel._tokenRows || [];
        panel._tokenRows.push(row);

        tokens.forEach((token, index) => {
            const tokenEl = document.createElement('span');
            tokenEl.dataset.tokenIndex = String(index);
            tokenEl.dataset.latex = token.latex;
            tokenEl.textContent = token.display;
            tokenEl.style.cursor = 'text';
            tokenEl.style.borderRadius = '2px';
            tokenEl.style.padding = '0 1px';

            tokenEl.addEventListener('mousedown', event => {
                event.preventDefault();
                event.stopPropagation();
                clearTokenSelections(panel, row);
                row._dragging = true;
                selectTokenRange(row, index, index);
            });

            tokenEl.addEventListener('mouseenter', () => {
                if (row._dragging) {
                    selectTokenRange(row, row._selectionStart, index);
                }
            });

            row.appendChild(tokenEl);
        });

        document.addEventListener('mouseup', () => {
            if (!row._dragging) {
                return;
            }

            row._dragging = false;
            const selected = row._tokens
                .slice(row._selectionStart, row._selectionEnd + 1)
                .map(token => token.latex)
                .join('');
            if (selected) {
                convertSelectedLatex(panel, selected);
            }
        });

        return row;
    };

    const createLineContent = (panel, line) => {
        const container = document.createElement('span');
        container.style.display = 'inline-flex';
        container.style.flexWrap = 'wrap';
        container.style.alignItems = 'baseline';
        container.style.gap = '4px';
        container.style.fontSize = '20px';
        container.style.fontFamily = 'serif';

        const parts = line.displayParts.length ? line.displayParts : [{
            type: line.math ? 'math' : 'text',
            text: line.display || line.latex || line.stack || '',
            latex: line.math || ''
        }];

        parts.forEach(part => {
            if (part.type === 'math' && part.latex) {
                const tokenSelector = createTokenSelector(panel, part.latex);
                if (tokenSelector) {
                    tokenSelector.style.marginLeft = '0';
                    container.appendChild(tokenSelector);
                }
                return;
            }

            const text = document.createElement('span');
            text.textContent = part.text || '';
            text.style.whiteSpace = 'pre-wrap';
            text.style.fontFamily = 'inherit';
            container.appendChild(text);
        });

        return container;
    };

    const updateResultPanel = (panel, rawLatex, stackResult, answerBox, lines) => {
        const resultLines = normalizeResultLines(rawLatex, stackResult, lines);
        let defaultIndex = Math.max(0, resultLines.length - 1);
        for (let i = resultLines.length - 1; i >= 0; i--) {
            if (resultLines[i].stack) {
                defaultIndex = i;
                break;
            }
        }
        panel.style.display = 'block';
        panel._rawTextarea.value = rawLatex || '';
        panel._options.innerHTML = '';
        panel._tokenRows = [];

        resultLines.forEach((line, index) => {
            const isDefault = index === defaultIndex;
            const optionId = 'local-stackinputhelper-line-' + Math.random().toString(36).slice(2);
            const wrapper = document.createElement('label');
            wrapper.setAttribute('for', optionId);
            wrapper.style.display = 'grid';
            wrapper.style.gridTemplateColumns = 'auto 1fr';
            wrapper.style.columnGap = '8px';
            wrapper.style.alignItems = 'start';
            wrapper.style.padding = '6px';
            wrapper.style.border = isDefault ? '1px solid #8ab4f8' : '1px solid #e2e2e2';
            wrapper.style.background = isDefault ? '#f3f8ff' : '#fff';
            wrapper.style.cursor = 'pointer';
            wrapper.style.userSelect = 'text';

            const input = document.createElement('input');
            input.type = 'radio';
            input.name = panel._choiceName;
            input.id = optionId;
            input.value = String(index);
            input.checked = isDefault;
            input.style.marginTop = '3px';

            const body = document.createElement('span');
            body.style.display = 'block';
            const prefix = document.createElement('span');
            prefix.textContent = (config.lineprefix || 'Line') + ' ' + (index + 1);
            if (isDefault) {
                prefix.textContent += ' - ' + (config.recommendedanswer || 'Recommended answer');
            }
            prefix.style.display = 'block';
            prefix.style.fontSize = '12px';
            prefix.style.color = '#555';
            prefix.style.marginBottom = '4px';

            const lineContent = createLineContent(panel, line);

            body.appendChild(prefix);
            body.appendChild(lineContent);
            wrapper.appendChild(input);
            wrapper.appendChild(body);
            panel._options.appendChild(wrapper);

            wrapper.addEventListener('click', event => {
                if (event.target.closest('[data-token-index]')) {
                    return;
                }
                input.checked = true;
                clearTokenSelections(panel);
                panel._stackTextarea.value = line.stack || line.math || '';
            });

            input.addEventListener('change', () => {
                if (input.checked) {
                    clearTokenSelections(panel);
                    panel._stackTextarea.value = line.stack || line.math || '';
                }
            });
        });

        const selected = resultLines[defaultIndex];
        panel._stackTextarea.value = selected ? (selected.stack || selected.math || '') : (stackResult || '');
        panel._applyBtn.onclick = () => setAnswerValue(answerBox, panel._stackTextarea.value || '');
        typesetMath(panel._options);
    };

    const createMobileSession = async () => {
        const formData = new FormData();
        formData.append('sesskey', config.sesskey);

        const response = await fetch(config.sessionCreateUrl, {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || ('HTTP ' + response.status));
        }

        return data;
    };

    const fetchSessionResult = async (sessionId) => {
        const separator = config.sessionResultUrl.indexOf('?') === -1 ? '?' : '&';
        const response = await fetch(config.sessionResultUrl + separator + 'session=' + encodeURIComponent(sessionId), {
            credentials: 'same-origin'
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || ('HTTP ' + response.status));
        }

        return data;
    };

    const buildQrUrl = (text) => {
        return 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(text);
    };

    const icons = {
        image: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"></rect><circle cx="8.5" cy="8.5" r="1.5" fill="none" stroke="currentColor" stroke-width="2"></circle><path d="M21 15l-5-5L5 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
        camera: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M14.5 4l1.5 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l1.5-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="2"></circle></svg>'
    };

    const setIconButtonLabel = (button, label) => {
        button.title = label;
        button.setAttribute('aria-label', label);
    };

    const createIconButton = (label, icon, background) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.innerHTML = icon;
        setIconButtonLabel(button, label);
        button.style.marginLeft = '8px';
        button.style.width = '36px';
        button.style.height = '34px';
        button.style.padding = '0';
        button.style.border = '1px solid #999';
        button.style.borderRadius = '4px';
        button.style.background = background;
        button.style.color = '#1f2937';
        button.style.display = 'inline-flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.verticalAlign = 'middle';
        button.style.cursor = 'pointer';
        return button;
    };

    const attachButton = (answerBox) => {
        if (!answerBox || answerBox.dataset.stackinputhelperBound === '1') {
            return;
        }

        answerBox.dataset.stackinputhelperBound = '1';

        const fileInput = createHiddenFileInput();
        const resultPanel = createResultPanel();
        const mobilePanel = createMobilePanel();
        let mobilePollTimer = null;
        let lastMobileResultVersion = '';

        const uploadLabel = config.uploadbtn || 'Upload math image';
        const mobileLabel = config.mobilebtn || 'Mobile Math Upload';
        const uploadBtn = createIconButton(uploadLabel, icons.image, '#f5f5f5');
        const mobileBtn = createIconButton(mobileLabel, icons.camera, '#eef6ff');

        uploadBtn.addEventListener('click', () => {
            fileInput.value = '';
            fileInput.click();
        });

        fileInput.addEventListener('change', async () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) {
                return;
            }

            uploadBtn.disabled = true;
            setIconButtonLabel(uploadBtn, config.uploading || 'Recognizing...');

            try {
                const result = await postImage(config.recognizeUrl, file);
                const stackResult = result.stack || result.normalized || result.text || '';

                if (!stackResult) {
                    throw new Error('Empty STACK result');
                }

                updateResultPanel(resultPanel, result.raw_latex || '', stackResult, answerBox, result.lines || []);
            } catch (error) {
                window.console.error('[stackinputhelper] recognition failed:', error);
                window.alert((config.recognizefailed || 'Recognition failed.') + '\n' + error.message);
            } finally {
                uploadBtn.disabled = false;
                setIconButtonLabel(uploadBtn, uploadLabel);
            }
        });

        mobileBtn.addEventListener('click', async () => {
            try {
                if (mobilePollTimer) {
                    window.clearInterval(mobilePollTimer);
                    mobilePollTimer = null;
                }
                lastMobileResultVersion = '';

                mobileBtn.disabled = true;
                setIconButtonLabel(mobileBtn, config.creatingmobilesession || 'Creating mobile upload session...');

                const data = await createMobileSession();
                const sessionId = data.session_id;

                mobilePanel.style.display = 'block';
                mobilePanel._link.href = data.mobile_url;
                mobilePanel._link.textContent = data.mobile_url;
                mobilePanel._qrImg.src = buildQrUrl(data.mobile_url);
                if (data.mobile_url_warning) {
                    mobilePanel._warning.textContent = data.mobile_url_warning;
                    mobilePanel._warning.style.display = 'block';
                } else {
                    mobilePanel._warning.textContent = '';
                    mobilePanel._warning.style.display = 'none';
                }
                mobilePanel._status.textContent = config.waitingmobileupload || 'Waiting for mobile upload...';

                mobileBtn.disabled = false;
                setIconButtonLabel(mobileBtn, mobileLabel);

                const start = Date.now();
                const timeoutMs = 10 * 60 * 1000;
                mobilePollTimer = window.setInterval(async () => {
                    try {
                        const result = await fetchSessionResult(sessionId);

                        if (result.ready) {
                            const stackResult = result.stack || result.text || '';
                            const resultVersion = [
                                result.updated_at || '',
                                result.raw_latex || '',
                                stackResult
                            ].join(':');

                            if (resultVersion !== lastMobileResultVersion) {
                                lastMobileResultVersion = resultVersion;
                                mobilePanel._status.textContent = config.mobileuploadreceived || 'Successfully received mobile result. You can upload another photo with the same QR code.';
                                updateResultPanel(resultPanel, result.raw_latex || '', stackResult, answerBox, result.lines || []);
                            }
                        } else if (result.expired) {
                            window.clearInterval(mobilePollTimer);
                            mobilePollTimer = null;
                            mobilePanel._status.textContent = config.mobileuploadexpired || 'This mobile upload session has expired.';
                        } else {
                            mobilePanel._status.textContent = config.waitingmobileupload || 'Waiting for mobile upload...';
                        }

                        if (Date.now() - start > timeoutMs) {
                            window.clearInterval(mobilePollTimer);
                            mobilePollTimer = null;
                            mobilePanel._status.textContent = config.mobileuploadtimeout || 'Timeout waiting for result. Please create a new session.';
                        }
                    } catch (error) {
                        window.console.error('[stackinputhelper] polling failed:', error);
                    }
                }, 2000);
            } catch (error) {
                window.console.error('[stackinputhelper] mobile session failed:', error);
                window.alert((config.mobilesessionfailed || 'Failed to create mobile session:') + ' ' + error.message);
                mobileBtn.disabled = false;
                setIconButtonLabel(mobileBtn, mobileLabel);
            }
        });

        answerBox.insertAdjacentElement('afterend', uploadBtn);
        if (config.enablemobile) {
            uploadBtn.insertAdjacentElement('afterend', mobileBtn);
            mobileBtn.insertAdjacentElement('afterend', mobilePanel);
            mobilePanel.insertAdjacentElement('afterend', resultPanel);
        } else {
            uploadBtn.insertAdjacentElement('afterend', resultPanel);
        }
    };

    const run = () => {
        const boxes = findAnswerBoxes();
        if (!boxes.length) {
            window.console.warn(config.nofieldfound || 'No visible STACK input found');
            return;
        }
        boxes.forEach(attachButton);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
