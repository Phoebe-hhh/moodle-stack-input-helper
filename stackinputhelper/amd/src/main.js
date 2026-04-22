const findAnswerBox = () => {
    const candidates = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
    return candidates.find(el => el.offsetParent !== null) || null;
};

const attachButton = (answerBox, config) => {
    if (!answerBox || answerBox.dataset.stackinputhelperBound === '1') {
        return;
    }

    answerBox.dataset.stackinputhelperBound = '1';

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = config.uploadbtn;
    button.style.marginLeft = '8px';

    button.addEventListener('click', () => {
        window.alert('按钮已经加载成功，下一步我们再接图片上传和识别。');
    });

    answerBox.insertAdjacentElement('afterend', button);
};

export const init = (config) => {
    const answerBox = findAnswerBox();

    if (!answerBox) {
        console.warn(config.nofieldfound);
        return;
    }

    attachButton(answerBox, config);
};
