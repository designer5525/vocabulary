// --- 全域變數 ---
let allWords = [];
let genduAll = []; // 存儲 gendu.csv 的所有數據
let genduFavorites = JSON.parse(localStorage.getItem('genduFavs')) || [];
let currentFavTab = 'word';
let favorites = JSON.parse(localStorage.getItem('favWords')) || [];
let currentList = [];
let currentIndex = 0;
let currentMode = 'standard'; // 新增：用來記錄目前是 'standard' (背單詞) 還是 'listening' (聽單詞)

// --- 語音鎖定邏輯 (鎖定 142 號) ---
let synth = window.speechSynthesis;
let voices = [];

function getBestVoice() {
    voices = synth.getVoices();
    if (voices.length > 142) return voices[142];
    return voices.find(v => v.lang.includes('en-US')) || voices.find(v => v.lang.includes('en')) || voices[0];
}

function speak(text) {
    if (synth.speaking) synth.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    const voice = getBestVoice();
    if (voice) msg.voice = voice;
    msg.lang = 'en-US';
    msg.rate = 0.75;
    synth.speak(msg);
}

// --- 初始化與 CSV ---
async function loadCSV() {
    try {
        // 加載單詞庫
        const resWord = await fetch('word.csv');
        const dataWord = await resWord.text();
        allWords = dataWord.split(/\r?\n/)
            .filter(line => line.trim() !== '' && line.includes(','))
            .map(line => {
                const parts = line.split(',');
                return { en: parts[0].trim(), cn: parts[1].trim(), cat: parseInt(parts[2].trim()) };
            });

        // 加載跟讀庫 (Type,Content,Translation,Extra,Translation2)
        const resGendu = await fetch('gendu.csv');
        const dataGendu = await resGendu.text();
        genduAll = dataGendu.split(/\r?\n/)
            .filter(line => line.trim() !== '' && line.includes(','))
            .map(line => {
                // 處理可能包含引號的 CSV 格式
                const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
                const clean = parts.map(p => p.replace(/^"|"$/g, '').trim());
                return {
                    type: clean[0],        // duanyu 或 juzi
                    content: clean[1],     // 核心英文內容
                    translation: clean[2], // 中文翻譯
                    extra: clean[3],       // 提問/額外英文
                    translation2: clean[4] // 額外中文翻譯
                };
            });
        console.log("數據加載完成");
    } catch (err) { console.error("加載失敗", err); }
}

// --- 跟讀模塊邏輯 ---
function startDuanyu() {
    renderGenduList('duanyu', 'duanyu-list');
    switchPage('duanyu-screen');
}
function startJuzi() {
    renderGenduList('juzi', 'juzi-list');
    switchPage('juzi-screen');
}

// 渲染列表：依照您的截圖要求進行佈局
function renderGenduList(type, containerId) {
    const container = document.getElementById(containerId);
    const data = genduAll.filter(item => item.type === type);
    
    container.innerHTML = data.map(item => {
        const isFav = genduFavorites.some(f => f.content === item.content);
        return `
            <div class="gendu-card" onclick="speak('${item.content.replace(/'/g, "\\'")}')">
                <div class="gendu-text">
                    <p class="gendu-extra">問：${item.extra} (${item.translation2})</p>
                    <p class="gendu-content">${item.content}</p>
                </div>
                <button class="fav-icon-btn" onclick="toggleGenduFav(event, '${item.content.replace(/'/g, "\\'")}')">
                    <i class="${isFav ? 'fas' : 'far'} fa-star"></i>
                </button>
            </div>
        `;
    }).join('');
}

// 跟讀收藏邏輯
function toggleGenduFav(event, content) {
    event.stopPropagation();
    const item = genduAll.find(g => g.content === content);
    const idx = genduFavorites.findIndex(f => f.content === content);
    
    if (idx > -1) {
        genduFavorites.splice(idx, 1);
        event.target.closest('i').className = 'far fa-star';
    } else {
        genduFavorites.push(item);
        event.target.closest('i').className = 'fas fa-star';
    }
    localStorage.setItem('genduFavs', JSON.stringify(genduFavorites));
}

// --- 學習模塊邏輯 ---

// 新增：Fisher-Yates 洗牌演算法，確保完全隨機且均勻
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function startLearning(mode) {
    currentMode = mode; 
    let rawList = (mode === 'fav') ? favorites : allWords;
    
    if (rawList.length === 0) {
        alert("清單是空的喔！");
        return;
    }

    // --- 修改點：使用更精確的洗牌，並存入 currentList ---
    currentList = shuffle([...rawList]); 
    currentIndex = 0;
    
    let title = "背單詞";
    if (mode === 'listening') title = "聽單詞 (聽力練習)";
    if (mode === 'fav') title = "複習收藏";
    
    document.getElementById('page-title').innerText = title;
    switchPage('card-page');
    showWord();
}

function showWord() {
    const word = currentList[currentIndex];
    const wordEnEl = document.getElementById('word-en');
    const wordCnEl = document.getElementById('word-cn');
    const hintEl = document.getElementById('click-hint');

    // 填入文字（包含單詞和短語，延續之前的優化）
    wordEnEl.innerText = word.en;
    wordCnEl.innerText = word.cn;

    // 如果你有短語欄位，可以在這裡更新短語顯示
    const phraseArea = document.getElementById('phrase-display');
    if (phraseArea) {
        if (word.phrase) {
            phraseArea.innerHTML = `<p class="phrase-text">語境: ${word.phrase}</p>`;
            phraseArea.classList.remove('hidden');
        } else {
            phraseArea.classList.add('hidden');
        }
    }

    if (currentMode === 'listening') {
        wordEnEl.classList.add('hidden');
        wordCnEl.classList.add('hidden');
        hintEl.innerText = "🔊 點擊卡片查看答案";
    } else {
        wordEnEl.classList.remove('hidden');
        wordCnEl.classList.add('hidden');
        hintEl.innerText = "點擊查看中文";
    }

    hintEl.classList.remove('hidden');
    updateFavBtnUI(word.en);
    
    // 出現時立即朗讀單詞
    speak(word.en);
}

function revealTranslation() {
    const wordEnEl = document.getElementById('word-en');
    const wordCnEl = document.getElementById('word-cn');
    const hintEl = document.getElementById('click-hint');

    // 點擊後，英文和中文全部顯示
    wordEnEl.classList.remove('hidden');
    wordCnEl.classList.remove('hidden');
    hintEl.classList.add('hidden');
}

// --- 輔助功能 ---
function switchPage(pageId) {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
}

function goHome() { synth.cancel(); switchPage('home-page'); }

function nextWord() {
    currentIndex++;

    // --- 修改點：檢查是否已經跑完一輪 ---
    if (currentIndex >= currentList.length) {
        // 提醒媽媽已經完成一輪
        console.log("一輪結束，重新打亂順序開啟新的一輪");
        
        // 重新洗牌
        let rawList = (currentMode === 'fav') ? favorites : allWords;
        currentList = shuffle([...rawList]);
        currentIndex = 0;
    }
    
    showWord();
}

function replayVoice(e) { 
    if(e) e.stopPropagation(); 
    speak(currentList[currentIndex].en); 
}

function toggleFavorite(e) {
    e.stopPropagation();
    const word = currentList[currentIndex];
    const idx = favorites.findIndex(f => f.en === word.en);
    if (idx > -1) favorites.splice(idx, 1);
    else favorites.push(word);
    localStorage.setItem('favWords', JSON.stringify(favorites));
    updateFavBtnUI(word.en);
}

function updateFavBtnUI(wordEn) {
    const isFav = favorites.some(f => f.en === wordEn);
    const btn = document.getElementById('fav-btn');
    if (btn) {
        btn.innerHTML = isFav ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
        btn.style.color = isFav ? '#f1c40f' : '#666';
    }
}

// --- 5. 模塊二：我的收藏列表 ---
function showFavoritesPage() {
    switchPage('favorites-list-page');
    // 預設切換到 'word' 標籤
    switchFavTab('word'); 
}

// 核心：切換標籤與渲染邏輯
function switchFavTab(tab) {
    currentFavTab = tab;
    
    // 1. 更新按鈕樣式
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.includes(tab === 'word' ? '單詞' : '跟讀')) {
            btn.classList.add('active');
        }
    });

    const container = document.getElementById('fav-list-container');
    const reviewBtn = document.getElementById('start-fav-review-btn');

    if (tab === 'word') {
        // 顯示單詞收藏列表
        reviewBtn.style.display = 'block';
        if (favorites.length === 0) {
            container.innerHTML = '<p class="empty-msg">尚無單詞收藏</p>';
        } else {
            container.innerHTML = favorites.map((word, idx) => `
                <div class="fav-item">
                    <div>
                        <p class="fav-en">${word.en}</p>
                        <p class="fav-cn">${word.cn}</p>
                    </div>
                    <div class="fav-actions">
                        <button onclick="speak('${word.en.replace(/'/g, "\\'")}')" class="voice-btn">🔊</button>
                        <button onclick="removeFavorite(${idx})" class="del-btn">🗑️</button>
                    </div>
                </div>
            `).join('');
        }
    } else {
        // 顯示跟讀內容收藏列表 (採用您要求的列表卡片設計)
        reviewBtn.style.display = 'none';
        if (genduFavorites.length === 0) {
            container.innerHTML = '<p class="empty-msg">尚無跟讀收藏</p>';
        } else {
            container.innerHTML = genduFavorites.map(item => `
                <div class="gendu-card" onclick="speak('${item.content.replace(/'/g, "\\'")}')">
                    <div class="gendu-text">
                        <p class="gendu-extra">問：${item.extra}</p>
                        <p class="gendu-content">${item.content}</p>
                    </div>
                    <i class="fas fa-volume-up" style="color: #4a90e2"></i>
                </div>
            `).join('');
        }
    }
}

// --- 6. 模塊三 & 四：測試邏輯 ---
function startTest(mode) {
    if (allWords.length < 3) {
        alert("詞庫單詞不足 3 個，無法進行測試！");
        return;
    }
    testMode = mode;
    resetTest();
    switchPage('test-page');
    // 修改標題名稱更貼切
    document.getElementById('test-title').innerText = (mode === 'en-to-cn' ? '英文聽力測試' : '中文翻譯測試');
    
    const voiceBtn = document.getElementById('test-voice-btn');
    if (mode === 'en-to-cn') {
        voiceBtn.classList.remove('hidden');
    } else {
        voiceBtn.classList.add('hidden');
    }
}

function resetTest() {
    score = 0;
    questionCount = 0;
    updateScoreUI();
    nextQuestion();
}

function updateScoreUI() {
    document.getElementById('test-score').innerText = `分數: ${score}`;
}

function nextQuestion() {
    if (questionCount >= 20) {
        showFinalResult();
        return;
    }
    
    questionCount++;
    document.getElementById('q-number').innerText = questionCount;
    document.getElementById('next-q-btn').disabled = true;

    currentQuestionWord = allWords[Math.floor(Math.random() * allWords.length)];
    let options = generateOptions(currentQuestionWord);
    
    // --- 修改部分：英文測試時隱藏單詞文字 ---
    const qText = document.getElementById('question-text');
    if (testMode === 'en-to-cn') {
        qText.innerText = "---"; // 顯示佔位符號
        speak(currentQuestionWord.en); // 觸發語音
    } else {
        qText.innerText = currentQuestionWord.cn;
    }

    const container = document.getElementById('options-container');
    container.innerHTML = '';
    options.forEach(opt => {
        const div = document.createElement('div');
        div.className = 'option-card';
        const displayValue = (testMode === 'en-to-cn' ? opt.cn : opt.en);
        div.innerHTML = `<span>${displayValue}</span><span class="status-icon"></span>`;
        div.onclick = () => checkAnswer(div, opt);
        container.appendChild(div);
    });
}

function replayTestVoice() {
    if (currentQuestionWord) speak(currentQuestionWord.en);
}

function generateOptions(correct) {
    let opts = [correct];

    // --- 新增：找出所有屬於同一個類別 (cat) 的其他單詞 ---
    // 這會過濾掉正確答案本身
    let sameCatWords = allWords.filter(w => w.cat === correct.cat && w.en !== correct.en);

    // 1. 優先從「同類詞」中隨機抽取干擾項
    while (opts.length < 3 && sameCatWords.length > 0) {
        let randomIndex = Math.floor(Math.random() * sameCatWords.length);
        let randomWord = sameCatWords.splice(randomIndex, 1)[0]; // 取出並從暫時清單移除，避免重複抽取
        
        const targetVal = (testMode === 'en-to-cn' ? randomWord.cn : randomWord.en);
        
        // 沿用你原本的防重複檢查邏輯
        if (!opts.some(o => (testMode === 'en-to-cn' ? o.cn : o.en) === targetVal)) {
            opts.push(randomWord);
        }
    }

    // 2. 如果同類詞不夠（或是防重複檢查過濾掉了太多同類詞），再從「全詞庫」隨機補齊
    while (opts.length < 3) {
        let randomWord = allWords[Math.floor(Math.random() * allWords.length)];
        const targetVal = (testMode === 'en-to-cn' ? randomWord.cn : randomWord.en);
        
        // 沿用你原本的防重複檢查邏輯
        if (!opts.some(o => (testMode === 'en-to-cn' ? o.cn : o.en) === targetVal)) {
            opts.push(randomWord);
        }
    }

    return opts.sort(() => Math.random() - 0.5);
}

function checkAnswer(selectedDiv, selectedWord) {
    const allOptions = document.querySelectorAll('.option-card');
    allOptions.forEach(opt => opt.classList.add('disabled'));
    document.getElementById('next-q-btn').disabled = false;

    // --- 修改部分：點擊後揭曉正確英文單詞 ---
    if (testMode === 'en-to-cn') {
        document.getElementById('question-text').innerText = currentQuestionWord.en;
    }

    const isCorrect = (selectedWord.en === currentQuestionWord.en);

    if (isCorrect) {
        score += 5;
        selectedDiv.classList.add('correct');
        selectedDiv.querySelector('.status-icon').innerHTML = '<i class="fas fa-check"></i>';
        updateScoreUI();
    } else {
        selectedDiv.classList.add('wrong');
        selectedDiv.querySelector('.status-icon').innerHTML = '<i class="fas fa-times"></i>';
        
        allOptions.forEach(div => {
            const val = div.querySelector('span').innerText;
            const correctVal = (testMode === 'en-to-cn' ? currentQuestionWord.cn : currentQuestionWord.en);
            if (val === correctVal) {
                div.classList.add('correct');
                div.querySelector('.status-icon').innerHTML = '<i class="fas fa-check"></i>';
            }
        });
    }
}

// --- 聽力進階版專屬變數 ---
let advScore = 0;
let advQuestionCount = 0;
let advCurrentWord = null;

// 入口函數：從主頁點擊後觸發
function startListeningAdvanced() {
    if (allWords.length < 1) {
        alert("詞庫暫無單詞！");
        return;
    }
    advScore = 0;
    advQuestionCount = 0;
    updateAdvScoreUI();
    switchPage('listening-advanced-page');
    nextAdvQuestion();
}

function updateAdvScoreUI() {
    document.getElementById('adv-test-score').innerText = `分數: ${advScore}`;
}

function nextAdvQuestion() {
    if (advQuestionCount >= 20) {
        // 使用原有的結算邏輯，但傳入 advScore
        score = advScore; 
        showFinalResult();
        return;
    }

    advQuestionCount++;
    document.getElementById('adv-q-number').innerText = advQuestionCount;

    // 隨機選題
    advCurrentWord = allWords[Math.floor(Math.random() * allWords.length)];

    // 重置界面
    document.getElementById('adv-question-text').innerText = "---";
    document.getElementById('btn-reveal-adv').classList.remove('hidden');
    document.getElementById('adv-judge-btns').classList.add('hidden');

    // 播放語音 (鎖定 192 號由 speak 函數處理)
    speak(advCurrentWord.en);
}

// 揭曉答案
function revealAdvAnswer() {
    const qText = document.getElementById('adv-question-text');
    // 同時顯示英文和中文
    qText.innerHTML = `${advCurrentWord.en}<br><span style="font-size:24px; color:#666;">${advCurrentWord.cn}</span>`;
    
    // 切換按鈕
    document.getElementById('btn-reveal-adv').classList.add('hidden');
    document.getElementById('adv-judge-btns').classList.remove('hidden');
}

// 處理答對或答錯
function handleAdvJudge(isCorrect) {
    if (isCorrect) {
        advScore += 5;
        updateAdvScoreUI();
    }
    
    // 進入下一題
    setTimeout(() => {
        nextAdvQuestion();
    }, 300); // 稍微停頓增加反饋感
}

// 重複播放語音
function replayAdvVoice() {
    if (advCurrentWord) {
        speak(advCurrentWord.en);
    }
}

// --- 7. 結果頁面邏輯 ---
function showFinalResult() {
    switchPage('result-page');
    document.getElementById('final-score-text').innerText = score;
    
    let comment = "";
    if (score === 100) comment = "完美！媽媽你是天才！";
    else if (score >= 80) comment = "太棒了！非常厲害喔！";
    else if (score >= 60) comment = "及格了，繼續練習會更好！";
    else comment = "沒關係，我們再背幾遍就會了！";
    
    document.getElementById('result-comment').innerText = comment;
}

// --- 初始化啟動 ---
loadCSV();