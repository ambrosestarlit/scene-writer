// Scene*Writer Web版 - シーン構成型シナリオエディター
const app = {
    currentProject: null,
    cuts: [],
    currentCut: 0,
    characters: [],
    autoSaveInterval: null,

    init() {
        // シーン数ドロップダウンを1～300で初期化
        const sectionCountSelect = document.getElementById('sectionCount');
        if (sectionCountSelect && sectionCountSelect.children.length === 0) {
            for (let i = 1; i <= 300; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = i;
                if (i === 10) {
                    option.selected = true;
                }
                sectionCountSelect.appendChild(option);
            }
        }
        
        this.loadProjects();
        this.setupEventListeners();
        this.startClock();
        this.initializeWelcome();
    },

    initializeWelcome() {
        this.updateRecentProjects();
    },

    updateRecentProjects() {
        const list = document.getElementById('recentProjectsList');
        const projects = this.getRecentProjects();
        
        list.innerHTML = '';
        projects.forEach(project => {
            const item = document.createElement('div');
            item.className = 'welcome-recent-item';
            item.innerHTML = `
                <div class="welcome-recent-icon">📝</div>
                <div class="welcome-recent-info">
                    <div class="welcome-recent-name">${project.name}</div>
                    <div class="welcome-recent-date">${new Date(project.lastModified).toLocaleString('ja-JP')}</div>
                    <div class="welcome-recent-stats">${project.cuts}シーン / ${project.characters}文字</div>
                </div>
                <button class="welcome-recent-delete" onclick="app.deleteProject('${project.name}')">×</button>
            `;
            item.ondblclick = () => {
                console.log('Double clicked:', project.name);
                this.loadProject(project.name);
            };
            list.appendChild(item);
        });
    },

    getRecentProjects() {
        const stored = localStorage.getItem('voiceWriterProjects');
        return stored ? JSON.parse(stored) : [];
    },

    saveProjectList() {
        const projects = this.getRecentProjects();
        const existing = projects.findIndex(p => p.name === this.currentProject);
        
        const projectData = {
            name: this.currentProject,
            lastModified: new Date().toISOString(),
            cuts: this.cuts.length,
            characters: this.calculateTotalCharacters(this.currentProject)
        };
        
        if (existing >= 0) {
            projects[existing] = projectData;
        } else {
            projects.unshift(projectData);
        }
        
        localStorage.setItem('voiceWriterProjects', JSON.stringify(projects.slice(0, 20)));
    },

    calculateTotalCharacters(projectName) {
        const data = localStorage.getItem(`project_${projectName}`);
        if (!data) return 0;
        
        const project = JSON.parse(data);
        return project.cuts.reduce((sum, cut) => sum + (cut.content ? cut.content.length : 0), 0);
    },

    closeWelcome() {
        document.getElementById('welcomeScreen').style.display = 'none';
    },

    createNewProject() {
        const name = prompt('プロジェクト名を入力してください:', `プロジェクト_${Date.now()}`);
        if (!name) return;
        
        // プロジェクト情報フィールドをクリア（先にクリア）
        document.getElementById('projectTitle').value = '';
        document.getElementById('deadlineDate').value = '';
        document.getElementById('globalSynopsisEditor').value = '';
        document.getElementById('memoEditor').value = '';
        document.getElementById('contentEditor').value = '';
        document.getElementById('synopsisEditor').value = '';
        
        this.currentProject = name;
        this.cuts = [];
        for (let i = 0; i < 10; i++) {
            this.cuts.push({
                name: `Scene-${String(i + 1).padStart(2, '0')}`,
                content: '',
                synopsis: '',
                targetMinutes: 0
            });
        }
        this.characters = [];
        this.currentCut = -1; // loadCut(0)が確実にシーン切り替えとして認識されるように
        
        this.closeWelcome();
        document.getElementById('mainApp').style.display = 'flex';
        
        // DOM要素が表示された後に処理を実行
        setTimeout(() => {
            this.loadCut(0);
            this.updateCutList();
            this.updateCharacterButtons();
            this.updateTotalTarget();
            this.saveProject();
        }, 0);
        
        this.showStatus('新規プロジェクトを作成しました');
    },

    loadProject(name) {
        console.log('loadProject called with:', name);
        
        // 引数がない場合はファイル選択ダイアログを表示
        if (!name) {
            this.openFileDialog();
            return;
        }
        
        const data = localStorage.getItem(`project_${name}`);
        if (!data) {
            console.log('Project not found in localStorage:', `project_${name}`);
            this.showStatus('プロジェクトが見つかりません');
            return;
        }
        
        const project = JSON.parse(data);
        
        // 旧バージョンのCut-表記をScene-表記に自動変換
        const cuts = project.cuts || [];
        cuts.forEach(cut => {
            if (cut.name && cut.name.startsWith('Cut-')) {
                cut.name = cut.name.replace('Cut-', 'Scene-');
            }
        });
        
        // エディターを先にクリア（前のプロジェクトの内容が残らないように）
        document.getElementById('contentEditor').value = '';
        document.getElementById('synopsisEditor').value = '';
        
        // プロジェクトデータを設定
        this.currentProject = name;
        this.cuts = cuts;
        this.characters = project.characters || [];
        this.currentCut = -1; // loadCut(0)が確実にシーン切り替えとして認識されるように
        
        document.getElementById('projectTitle').value = project.title || '';
        document.getElementById('deadlineDate').value = project.deadline || '';
        document.getElementById('globalSynopsisEditor').value = project.globalSynopsis || '';
        
        // ウェルカム画面を閉じてメインアプリを表示
        this.closeWelcome();
        document.getElementById('mainApp').style.display = 'flex';
        
        // DOM要素が表示された後に処理を実行
        setTimeout(() => {
            console.log('=== loadProject Debug ===');
            console.log('Scene-01 content after load:', this.cuts[0]?.content?.substring(0, 50));
            console.log('Editor value before loadCut:', document.getElementById('contentEditor').value.substring(0, 50));
            
            this.loadCut(0);
            
            console.log('Editor value after loadCut:', document.getElementById('contentEditor').value.substring(0, 50));
            this.updateCutList();
            this.updateCharacterButtons();
            this.updateTotalTarget();
        }, 0);
        
        this.showStatus(`プロジェクト「${name}」を読み込みました`);
    },

    openFileDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.vwp,.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importProjectFile(file);
            }
        };
        input.click();
    },

    importProjectFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const projectName = file.name.replace(/\.(vwp|json)$/, '');
                
                console.log('Importing project:', projectName);
                console.log('Project data:', data);
                
                // プロジェクトをlocalStorageに保存
                localStorage.setItem(`project_${projectName}`, e.target.result);
                
                // プロジェクトを読み込む
                this.loadProject(projectName);
                
                this.showStatus(`ファイル「${file.name}」を読み込みました`);
            } catch (error) {
                console.error('Import error:', error);
                alert(`ファイルの読み込みに失敗しました。\nエラー: ${error.message}`);
                this.showStatus('ファイルの読み込みに失敗しました');
            }
        };
        reader.readAsText(file);
    },

    saveProject() {
        if (!this.currentProject) return;
        
        // 現在編集中の内容を保存
        this.saveCutContent();
        
        console.log('=== saveProject Debug ===');
        console.log('currentCut:', this.currentCut);
        console.log('Scene-01 content before save:', this.cuts[0]?.content?.substring(0, 50));
        
        const project = {
            cuts: this.cuts,
            characters: this.characters,
            title: document.getElementById('projectTitle').value,
            deadline: document.getElementById('deadlineDate').value,
            globalSynopsis: document.getElementById('globalSynopsisEditor').value,
            lastModified: new Date().toISOString()
        };
        
        localStorage.setItem(`project_${this.currentProject}`, JSON.stringify(project));
        this.saveProjectList();
        
        // 保存完了ダイアログを表示
        alert(`プロジェクト「${this.currentProject}」を保存しました。`);
        this.showStatus('保存しました');
    },

    deleteProject(name) {
        if (!confirm(`プロジェクト「${name}」を削除しますか？`)) return;
        
        localStorage.removeItem(`project_${name}`);
        const projects = this.getRecentProjects().filter(p => p.name !== name);
        localStorage.setItem('voiceWriterProjects', JSON.stringify(projects));
        this.updateRecentProjects();
        this.showStatus('プロジェクトを削除しました');
    },

    exportProject() {
        if (!this.currentProject) {
            this.showStatus('プロジェクトが開かれていません');
            return;
        }
        
        this.saveCutContent();
        const data = localStorage.getItem(`project_${this.currentProject}`);
        if (!data) return;
        
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentProject}.vwp`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showStatus('エクスポートしました');
    },

    exportTxt() {
        if (!this.currentProject) {
            this.showStatus('プロジェクトが開かれていません');
            return;
        }
        
        let text = `プロジェクト: ${this.currentProject}\n`;
        text += `作成日時: ${new Date().toLocaleString('ja-JP')}\n`;
        text += '='.repeat(50) + '\n\n';
        
        this.cuts.forEach(cut => {
            text += `【${cut.name}】\n`;
            if (cut.synopsis) {
                text += `あらすじ: ${cut.synopsis}\n`;
            }
            text += `${cut.content}\n`;
            text += '-'.repeat(50) + '\n\n';
        });
        
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentProject}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showStatus('TXT書き出し完了');
    },

    backToWelcome() {
        if (this.currentProject) {
            this.saveProject();
        }
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('welcomeScreen').style.display = 'flex';
        this.updateRecentProjects();
    },

    loadProjects() {
        // 初期化処理
    },

    setupEventListeners() {
        document.getElementById('contentEditor').addEventListener('input', () => {
            this.updateCharCount();
        });
        
        document.getElementById('synopsisEditor').addEventListener('input', () => {
            if (this.cuts[this.currentCut]) {
                this.cuts[this.currentCut].synopsis = document.getElementById('synopsisEditor').value;
            }
        });
        
        document.getElementById('memoEditor').addEventListener('input', () => {
            if (this.currentProject) {
                localStorage.setItem(`memo_${this.currentProject}`, document.getElementById('memoEditor').value);
            }
        });
    },

    startClock() {
        setInterval(() => {
            const now = new Date();
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const clockDate = document.getElementById('clockDate');
            const clockTime = document.getElementById('clockTime');
            
            if (clockDate) {
                clockDate.textContent = 
                    `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}(${days[now.getDay()]})`;
            }
            if (clockTime) {
                clockTime.textContent = 
                    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            }
            
            // 文字数更新（現在編集中の内容も含める）
            let totalChars = 0;
            this.cuts.forEach((cut, index) => {
                if (index === this.currentCut) {
                    // 現在編集中のシーンは、エディターの内容を使用
                    const editor = document.getElementById('contentEditor');
                    const editorChars = editor ? editor.value.length : 0;
                    totalChars += editorChars;
                } else {
                    const cutChars = cut.content ? cut.content.length : 0;
                    totalChars += cutChars;
                }
            });
            
            const minutes = Math.floor(totalChars / 240);
            
            const totalCharCountClock = document.getElementById('totalCharCountClock');
            const totalCharCount = document.getElementById('totalCharCount');
            const estimatedDuration = document.getElementById('estimatedDuration');
            
            if (totalCharCountClock) totalCharCountClock.textContent = totalChars;
            if (totalCharCount) totalCharCount.textContent = totalChars;
            if (estimatedDuration) estimatedDuration.textContent = minutes;
        }, 1000);
    },

    applySectionCount() {
        const count = parseInt(document.getElementById('sectionCount').value);
        const currentCount = this.cuts.length;
        
        if (count > currentCount) {
            for (let i = currentCount; i < count; i++) {
                this.cuts.push({
                    name: `Scene-${String(i + 1).padStart(2, '0')}`,
                    content: '',
                    synopsis: '',
                    targetMinutes: 0
                });
            }
        } else if (count < currentCount) {
            if (!confirm(`シーン数を減らすと、${currentCount - count}個のシーンが削除されます。続行しますか？`)) {
                return;
            }
            this.cuts = this.cuts.slice(0, count);
            if (this.currentCut >= count) {
                this.currentCut = count - 1;
            }
        }
        
        this.updateCutList();
        this.loadCut(this.currentCut);
        this.showStatus(`シーン数を${count}に変更しました`);
    },

    updateTotalTarget() {
        // 全シーンの目標分数を合計
        let totalTargetMinutes = 0;
        this.cuts.forEach(cut => {
            if (cut.targetMinutes) {
                totalTargetMinutes += cut.targetMinutes;
            }
        });
        
        // 目標文字数を計算（1分240文字）
        const totalTargetChars = totalTargetMinutes * 240;
        
        // 表示を更新
        const totalTargetCharsElem = document.getElementById('totalTargetChars');
        const totalTargetMinutesElem = document.getElementById('totalTargetMinutes');
        
        if (totalTargetCharsElem) {
            totalTargetCharsElem.textContent = totalTargetChars.toLocaleString();
        }
        if (totalTargetMinutesElem) {
            totalTargetMinutesElem.textContent = totalTargetMinutes;
        }
    },

    setTargetMinutes() {
        const minutes = prompt('目標分数を入力してください:', '5');
        if (minutes && !isNaN(minutes)) {
            const targetMinutes = parseInt(minutes);
            this.cuts[this.currentCut].targetMinutes = targetMinutes;
            
            // 目標文字数を計算（1分240文字として）
            const targetChars = targetMinutes * 240;
            
            // 目標表示を更新
            const targetDisplay = document.getElementById('targetDisplay');
            const targetMinutesSpan = document.getElementById('targetMinutes');
            const targetCharsSpan = document.getElementById('targetChars');
            
            if (targetDisplay && targetMinutesSpan && targetCharsSpan) {
                targetDisplay.style.display = 'block';
                targetMinutesSpan.textContent = targetMinutes;
                targetCharsSpan.textContent = targetChars.toLocaleString();
            }
            
            // 総合目標も更新
            this.updateTotalTarget();
            
            this.showStatus(`目標分数を${minutes}分に設定しました`);
        }
    },

    updateCutList() {
        const list = document.getElementById('cutList');
        list.innerHTML = '';
        
        this.cuts.forEach((cut, index) => {
            const item = document.createElement('div');
            item.className = 'cut-item';
            if (index === this.currentCut) {
                item.classList.add('active');
            }
            
            const chars = cut.content ? cut.content.length : 0;
            const minutes = Math.floor(chars / 240);
            item.textContent = `${cut.name} (${chars}文字/${minutes}分)`;
            item.onclick = () => this.loadCut(index);
            
            list.appendChild(item);
        });
        
        // 現在のシーン情報更新
        const currentChars = this.cuts[this.currentCut] ? this.cuts[this.currentCut].content.length : 0;
        const currentMinutes = Math.floor(currentChars / 240);
        document.getElementById('currentCutLabel').textContent = this.cuts[this.currentCut].name;
        document.getElementById('currentCutStats').textContent = `${currentChars}文字 (${currentMinutes}分)`;
    },

    loadCut(index) {
        console.log('=== loadCut Debug ===');
        console.log('loadCut called with index:', index);
        console.log('currentCut before:', this.currentCut);
        console.log('Editor value before saveCutContent:', document.getElementById('contentEditor').value.substring(0, 50));
        
        // 異なるシーンに切り替える場合のみ、現在の内容を保存
        if (this.currentCut !== index) {
            this.saveCutContent();
            console.log('After saveCutContent, cuts[' + this.currentCut + '] content:', this.cuts[this.currentCut]?.content?.substring(0, 50));
        } else {
            console.log('Same scene, skipping saveCutContent');
        }
        
        this.currentCut = index;
        const cut = this.cuts[index];
        
        console.log('Loading cut:', cut.name);
        console.log('Cut content to load:', cut.content?.substring(0, 50));
        
        document.getElementById('contentEditor').value = cut.content || '';
        document.getElementById('synopsisEditor').value = cut.synopsis || '';
        
        console.log('Editor value after setting:', document.getElementById('contentEditor').value.substring(0, 50));
        
        // 目標分数が設定されている場合は表示
        const targetDisplay = document.getElementById('targetDisplay');
        const targetMinutesSpan = document.getElementById('targetMinutes');
        const targetCharsSpan = document.getElementById('targetChars');
        
        if (cut.targetMinutes && targetDisplay && targetMinutesSpan && targetCharsSpan) {
            targetDisplay.style.display = 'block';
            targetMinutesSpan.textContent = cut.targetMinutes;
            targetCharsSpan.textContent = (cut.targetMinutes * 240).toLocaleString();
        } else if (targetDisplay) {
            targetDisplay.style.display = 'none';
        }
        
        // 総合目標も更新
        this.updateTotalTarget();
        
        this.updateCutList();
        this.updateCharCount();
    },

    saveCutContent() {
        if (this.cuts[this.currentCut]) {
            this.cuts[this.currentCut].content = document.getElementById('contentEditor').value;
        }
    },

    updateCharCount() {
        const contentEditor = document.getElementById('contentEditor');
        const editorCharCount = document.getElementById('editorCharCount');
        
        if (!contentEditor || !editorCharCount) {
            console.warn('updateCharCount: contentEditor or editorCharCount not found');
            return;
        }
        
        const content = contentEditor.value;
        editorCharCount.textContent = content.length;
        
        // 現在のシーンの内容を最新の状態で保存してから集計
        this.saveCutContent();
        
        // 全体の文字数と分数をリアルタイム更新
        const totalChars = this.cuts.reduce((sum, cut) => sum + (cut.content ? cut.content.length : 0), 0);
        const totalCharCountClock = document.getElementById('totalCharCountClock');
        const totalCharCount = document.getElementById('totalCharCount');
        const estimatedDuration = document.getElementById('estimatedDuration');
        
        if (totalCharCountClock) totalCharCountClock.textContent = totalChars;
        if (totalCharCount) totalCharCount.textContent = totalChars;
        if (estimatedDuration) estimatedDuration.textContent = Math.floor(totalChars / 240);
        
        // 現在のシーン情報も更新
        this.updateCutList();
    },

    openCharacterManager() {
        const name = prompt('キャラクター名を入力してください:');
        if (name && !this.characters.includes(name)) {
            this.characters.push(name);
            this.updateCharacterButtons();
            this.showStatus(`キャラクター「${name}」を追加しました`);
        }
    },

    updateCharacterButtons() {
        const panel = document.getElementById('charButtonPanel');
        console.log('updateCharacterButtons called, panel:', panel);
        console.log('characters:', this.characters);
        
        if (!panel) {
            console.error('charButtonPanel not found!');
            return;
        }
        
        panel.innerHTML = '';
        
        this.characters.forEach(char => {
            const btn = document.createElement('button');
            btn.className = 'char-button';
            btn.textContent = char;
            btn.onclick = () => this.insertCharacter(char);
            panel.appendChild(btn);
        });
        
        // キャラ名ボタンと特殊文字ボタンの間に空白を追加
        if (this.characters.length > 0) {
            const spacer = document.createElement('span');
            spacer.style.display = 'inline-block';
            spacer.style.width = '12px';
            panel.appendChild(spacer);
        }
        
        // 特殊文字ボタンを追加
        const specialChars = ['…', 'っ', 'ッ', '♡', '〜', 'ー'];
        specialChars.forEach(char => {
            const btn = document.createElement('button');
            btn.className = 'char-button';
            btn.textContent = char;
            btn.onclick = () => this.insertSpecialChar(char);
            panel.appendChild(btn);
        });
        
        // 特殊文字ボタンとシーンボタンの間に空白を追加
        const spacer2 = document.createElement('span');
        spacer2.style.display = 'inline-block';
        spacer2.style.width = '12px';
        panel.appendChild(spacer2);
        
        // 【シーンA】〜【シーンD】ボタンを追加
        const cutLabels = ['【シーンA】', '【シーンB】', '【シーンC】', '【シーンD】'];
        cutLabels.forEach(label => {
            const btn = document.createElement('button');
            btn.className = 'char-button';
            btn.textContent = label;
            btn.onclick = () => this.insertSpecialChar(label);
            panel.appendChild(btn);
        });
        
        console.log('Buttons added, panel children:', panel.children.length);
    },

    insertCharacter(name) {
        const useQuote = document.getElementById('useQuoteCheckbox').checked;
        const useColon = document.getElementById('useColonCheckbox').checked;
        
        let text = '';
        if (useColon) {
            text = `${name}：`;
        } else if (useQuote) {
            text = `${name}「」`;
        } else {
            text = name;
        }
        
        this.insertText(text);
    },

    insertSpecialChar(char) {
        this.insertText(char);
    },

    insertText(text) {
        const editor = document.getElementById('contentEditor');
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const content = editor.value;
        
        editor.value = content.substring(0, start) + text + content.substring(end);
        editor.selectionStart = editor.selectionEnd = start + text.length;
        
        if (text.includes('「」')) {
            editor.selectionStart = editor.selectionEnd = start + text.length - 1;
        }
        
        editor.focus();
        this.saveCutContent();
        this.updateCharCount();
    },

    // ============================================================
    // テキスト挿入機能
    // ============================================================
    insertToGaki() {
        this.insertTextAtCursor('// ');
    },

    insertLocation() {
        this.insertTextAtCursor('〇 ');
    },

    openSoundEffect() {
        this.insertTextAtCursor('☆効果音//');
    },

    openBGM() {
        this.insertTextAtCursor('☆BGM//');
    },

    openAmbient() {
        this.insertTextAtCursor('☆環境音//');
    },

    insertTextAtCursor(text) {
        const editor = document.getElementById('contentEditor');
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const currentText = editor.value;
        
        // カーソル位置にテキストを挿入
        const newText = currentText.substring(0, start) + text + currentText.substring(end);
        editor.value = newText;
        
        // カーソル位置を挿入したテキストの後ろに移動
        editor.selectionStart = editor.selectionEnd = start + text.length;
        editor.focus();
        
        // データを保存
        this.saveCutContent();
        this.updateCharCount();
    },

    // =====================================================
    // 提供されたHTML版からの喘ぎ声生成実装（完全版）
    // =====================================================
    openMoanGenerator() {
        this.showMoanGeneratorWindow();
    },

    showMoanGeneratorWindow() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const window = document.createElement('div');
        window.style.cssText = `
            background: #e7d0a9;
            border-radius: 20px;
            width: 90%;
            max-width: 700px;
            max-height: 85vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 60px rgba(0,0,0,0.4);
        `;

        window.innerHTML = `
            <style>
                .moan-control-group {
                    margin-bottom: 15px;
                }
                .moan-label {
                    font-size: 13px;
                    font-weight: bold;
                    color: #7c5b53;
                    margin-bottom: 8px;
                    display: block;
                }
                .moan-radio-group {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 10px;
                }
                .moan-checkbox-group {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 8px;
                }
                .moan-slider {
                    width: 100%;
                    margin: 10px 0;
                }
                .moan-result {
                    background: #f9f9f9;
                    padding: 15px;
                    border-radius: 8px;
                    min-height: 100px;
                    font-family: 'MS Gothic', monospace;
                    font-size: 14px;
                    line-height: 1.8;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                .moan-btn {
                    padding: 10px 20px;
                    background: #c85a8b;
                    color: white;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 13px;
                    margin-right: 8px;
                }
                .moan-btn:hover {
                    background: #b74a7a;
                }
            </style>

            <div style="background: linear-gradient(to right, #c85a8b, #d87aa0); color: white; padding: 18px 25px; display: flex; justify-content: space-between; align-items: center; border-radius: 20px 20px 0 0;">
                <div style="font-size: 20px; font-weight: bold;">💕 喘ぎ声生成</div>
                <button onclick="this.closest('.moan-generator-modal').remove()" style="background: none; border: none; color: white; font-size: 28px; cursor: pointer; padding: 0 8px; line-height: 1;">×</button>
            </div>

            <div style="padding: 25px; background: white; overflow-y: auto; max-height: calc(85vh - 100px);">
                <div class="moan-control-group">
                    <div class="moan-label">喘ぎ声タイプ</div>
                    <div class="moan-radio-group">
                        <label><input type="radio" name="moanType" value="normal" checked> 通常</label>
                        <label><input type="radio" name="moanType" value="a-only"> 「あ」のみ</label>
                        <label><input type="radio" name="moanType" value="n-only"> 「ん」のみ</label>
                    </div>
                </div>

                <div class="moan-control-group">
                    <div class="moan-label">長さ: <span id="moanLength">20</span>語</div>
                    <input type="range" class="moan-slider" id="moanLengthSlider" min="5" max="50" value="20" 
                           oninput="document.getElementById('moanLength').textContent = this.value">
                </div>

                <div class="moan-control-group">
                    <div class="moan-label">オプション</div>
                    <div class="moan-checkbox-group">
                        <label><input type="checkbox" id="useDakuon"> 濁音を使う</label>
                        <label><input type="checkbox" id="useHeart" checked> ハート(♡)を付ける</label>
                        <label><input type="checkbox" id="useDialogue"> セリフを混ぜる</label>
                    </div>
                </div>

                <div class="moan-control-group" id="dialogueOptions" style="display: none;">
                    <div class="moan-label">セリフの種類</div>
                    <div class="moan-checkbox-group">
                        <label><input type="checkbox" class="dialogue-type" value="suki"> すき系</label>
                        <label><input type="checkbox" class="dialogue-type" value="onegai"> お願い系</label>
                        <label><input type="checkbox" class="dialogue-type" value="yamete"> やめて系</label>
                        <label><input type="checkbox" class="dialogue-type" value="kimochii"> きもちいい系</label>
                    </div>
                </div>

                <div style="margin: 20px 0;">
                    <button class="moan-btn" onclick="app.generateMoan()">生成</button>
                    <button class="moan-btn" style="background: #7c5b53;" onclick="app.insertGeneratedMoan()">挿入</button>
                </div>

                <div class="moan-control-group">
                    <div class="moan-label">生成結果</div>
                    <div class="moan-result" id="moanResult">ここに生成された喘ぎ声が表示されます</div>
                </div>
            </div>
        `;

        modal.appendChild(window);
        modal.className = 'moan-generator-modal';
        document.body.appendChild(modal);

        // セリフオプションの表示切替
        document.getElementById('useDialogue').addEventListener('change', (e) => {
            document.getElementById('dialogueOptions').style.display = e.target.checked ? 'block' : 'none';
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    },

    generateMoan() {
        const type = document.querySelector('input[name="moanType"]:checked').value;
        const length = parseInt(document.getElementById('moanLengthSlider').value);
        const useDakuon = document.getElementById('useDakuon').checked;
        const useHeart = document.getElementById('useHeart').checked;
        const useDialogue = document.getElementById('useDialogue').checked;

        const normalMoans = ['あっ', 'んっ', 'はぁっ', 'ふぁっ', 'ひゃっ', 'あぁっ', 'んんっ', 'はぁぁっ', 'ふぅっ', 'ひぅっ', 
                             'あんっ', 'んあっ', 'はぁんっ', 'ふぁぁっ', 'やっ', 'いっ', 'うっ', 'えっ', 'おっ', 'きゃっ',
                             'ひっ', 'ふっ', 'へっ', 'ほっ', 'くぅっ', 'あはっ', 'んはっ', 'はうっ', 'ふぅんっ', 'ひぃっ'];
        const aMoans = ['あっ', 'あぁっ', 'あああっ', 'ああぁっ', 'あんっ', 'あはっ', 'あぅっ', 'あぁぁっ'];
        const nMoans = ['んっ', 'んんっ', 'んぅっ', 'んああっ', 'んんんっ', 'んはっ', 'んぁっ', 'んふっ'];
        const dakuonMoans = ['ん゛っ', 'ん゛ん゛っ', 'ん゛あっ', 'ん゛ぅっ', 'んっ゛', 'んんっ゛', 'お゛っ', 'ん゛お゛っ', 'あ゛', 'あ゛あ゛っ'];
        
        const dialogues = {
            suki: ['好き', '大好き', 'すき', 'だいすき'],
            onegai: ['お願い', 'もっと', 'おねが', 'おね、が'],
            yamete: ['やめて', 'いや', 'やだ', 'だめ', 'らめ', 'だめぇ', 'らめぇ'],
            kimochii: ['気持ちいい', 'きもちいい', 'いい', 'きもちい', 'イッ', 'イクッ', 'イク', 'イク…', 'イクイクイクイク']
        };

        let moans = type === 'a-only' ? aMoans : type === 'n-only' ? nMoans : normalMoans;
        let result = [];

        // セリフの取得
        let selectedDialogues = [];
        if (useDialogue) {
            document.querySelectorAll('.dialogue-type:checked').forEach(checkbox => {
                selectedDialogues = selectedDialogues.concat(dialogues[checkbox.value] || []);
            });
        }

        for (let i = 0; i < length; i++) {
            // セリフを入れるか判定（10%の確率）
            if (useDialogue && selectedDialogues.length > 0 && Math.random() < 0.1) {
                const dialogue = selectedDialogues[Math.floor(Math.random() * selectedDialogues.length)];
                result.push(dialogue + (useHeart ? '♡' : ''));
            } else {
                // 濁音を使うか判定（30%の確率）
                let moan;
                if (useDakuon && Math.random() < 0.3) {
                    moan = dakuonMoans[Math.floor(Math.random() * dakuonMoans.length)];
                } else {
                    moan = moans[Math.floor(Math.random() * moans.length)];
                }
                result.push(moan + (useHeart ? '♡' : ''));
            }
        }

        const separator = type === 'normal' ? '……' : '　';
        const generatedText = result.join(separator);
        document.getElementById('moanResult').textContent = generatedText;
        this._generatedMoan = generatedText;
    },

    insertGeneratedMoan() {
        if (this._generatedMoan) {
            this.insertText(this._generatedMoan);
            document.querySelector('.moan-generator-modal').remove();
        } else {
            alert('先に喘ぎ声を生成してください');
        }
    },

    // =====================================================
    // 提供されたHTML版からのアダルト効果音実装（完全版）
    // =====================================================
    openAdultSound() {
        this.showAdultSoundWindow();
    },

    showAdultSoundWindow() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const window = document.createElement('div');
        window.style.cssText = `
            background: #e7d0a9;
            border-radius: 20px;
            width: 90%;
            max-width: 600px;
            max-height: 85vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 60px rgba(0,0,0,0.4);
        `;

        const soundButtons = [
            { category: 'ピストン', sounds: [
                { key: 'piston_slow', label: 'ピストン(ゆっくり)' },
                { key: 'piston_normal', label: 'ピストン(普通)' },
                { key: 'piston_hard', label: 'ピストン(激しい)' }
            ]},
            { category: 'パンパン', sounds: [
                { key: 'panpan_slow', label: 'パンパン(ゆっくり)' },
                { key: 'panpan_normal', label: 'パンパン(普通)' },
                { key: 'panpan_hard', label: 'パンパン(激しい)' }
            ]},
            { category: '手コキ', sounds: [
                { key: 'handjob_slow', label: '手コキ(ゆっくり)' },
                { key: 'handjob_normal', label: '手コキ(普通)' },
                { key: 'handjob_hard', label: '手コキ(激しい)' }
            ]},
            { category: '愛撫', sounds: [
                { key: 'caress_gentle', label: '愛撫(やさしい)' },
                { key: 'caress_hard', label: '愛撫(激しい)' }
            ]},
            { category: '挿入', sounds: [
                { key: 'insert', label: '挿入' }
            ]},
            { category: '射精', sounds: [
                { key: 'ejaculation_out_large', label: '射精(外に大量)' },
                { key: 'ejaculation_in_large', label: '射精(中に大量)' },
                { key: 'ejaculation_out_small', label: '射精(外に少量)' },
                { key: 'ejaculation_in_small', label: '射精(中に少量)' }
            ]}
        ];

        let buttonsHtml = '';
        soundButtons.forEach(category => {
            buttonsHtml += `
                <div style="margin-bottom: 15px;">
                    <div style="font-size: 13px; font-weight: bold; color: #7c5b53; margin-bottom: 8px;">【${category.category}】</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                        ${category.sounds.map(sound => `
                            <button onclick="app.insertAdultSound('${sound.label}')" 
                                    style="padding: 10px; background: #c85a8b; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: bold;">
                                ${sound.label}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        window.innerHTML = `
            <div style="background: linear-gradient(to right, #c85a8b, #d87aa0); color: white; padding: 18px 25px; display: flex; justify-content: space-between; align-items: center; border-radius: 20px 20px 0 0;">
                <div style="font-size: 20px; font-weight: bold;">🔞 アダルト効果音</div>
                <button onclick="this.closest('.adult-sound-modal').remove()" style="background: none; border: none; color: white; font-size: 28px; cursor: pointer; padding: 0 8px; line-height: 1;">×</button>
            </div>
            <div style="padding: 25px; background: white; overflow-y: auto; max-height: calc(85vh - 100px);">
                ${buttonsHtml}
            </div>
        `;

        modal.appendChild(window);
        modal.className = 'adult-sound-modal';
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    },

    insertAdultSound(soundText) {
        this.insertText(`♡${soundText}//`);
        document.querySelector('.adult-sound-modal').remove();
    },

    // =====================================================
    // 提供されたHTML版からの創作スロット実装（完全版）
    // =====================================================
    openCreativeSlot() {
        this.showCreativeSlotWindow();
    },

    showCreativeSlotWindow() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const window = document.createElement('div');
        window.style.cssText = `
            background: #e7d0a9;
            border-radius: 20px;
            width: 95%;
            max-width: 800px;
            max-height: 90vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 60px rgba(0,0,0,0.4);
        `;

        const slotData = {
            Kisetsu: ['春', '夏', '秋', '冬'],
            Jikan: ['朝', '昼', '夕方', '夜', '深夜'],
            Tenkou: ['晴れ', '曇り', '雨', '雪', '嵐'],
            Basho: ['家', '学校', '会社', 'ホテル', '温泉', 'プール'],
            Janru: ['ファンタジー', '現代', '未来', 'SF', '歴史', 'パラレル'],
            Kankei: ['恋人', '夫婦', '婚約者', '不倫', '初対面', '友人'],
            Aitemo: ['なし', 'ローション', '手錠', 'バイブ', 'ロープ', 'アイマスク'],
            Sichue: ['偶然の出会い', '密室', '盗撮', '強制', '合意', '交渉'],
            PureiA: ['前戯', 'キス', '愛撫', '脱衣', 'マッサージ'],
            PureiB: ['挿入', 'ピストン', '騎乗位', 'バック', '側位'],
            PureiC: ['オーラル', '手コキ', 'その他', 'クンニ', 'フェラ']
        };

        window.innerHTML = `
            <style>
                .slot-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                }
                .slot-item {
                    background: white;
                    padding: 12px;
                    border-radius: 10px;
                }
                .slot-label {
                    font-size: 13px;
                    font-weight: bold;
                    color: #7c5b53;
                    margin-bottom: 8px;
                }
                .slot-controls {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                .slot-result {
                    flex: 1;
                    padding: 8px;
                    background: #f9f9f9;
                    border: 1px solid #c4a88b;
                    border-radius: 6px;
                    font-size: 14px;
                    text-align: center;
                    min-height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .slot-btn {
                    padding: 8px 12px;
                    background: #a87b5a;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 16px;
                }
                .slot-btn:hover {
                    background: #96694d;
                }
                .slot-action-btn {
                    padding: 10px 20px;
                    background: #7c5b53;
                    color: white;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 13px;
                    margin-right: 8px;
                }
                .slot-action-btn:hover {
                    background: #6a4d45;
                }
                .slot-rating {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 15px;
                }
                .adult-section {
                    display: none;
                }
                .adult-section.show {
                    display: grid;
                }
            </style>

            <div style="background: linear-gradient(to right, #a87b5a, #c4a88b); color: white; padding: 18px 25px; display: flex; justify-content: space-between; align-items: center; border-radius: 20px 20px 0 0;">
                <div style="font-size: 20px; font-weight: bold;">🎰 創作支援スロット</div>
                <button onclick="this.closest('.slot-modal').remove()" style="background: none; border: none; color: white; font-size: 28px; cursor: pointer; padding: 0 8px; line-height: 1;">×</button>
            </div>

            <div style="padding: 25px; background: white; overflow-y: auto; max-height: calc(90vh - 150px);">
                <div class="slot-rating">
                    <label><input type="radio" name="slotRating" value="general" checked onchange="app.toggleSlotRating()"> 全年齢向け</label>
                    <label><input type="radio" name="slotRating" value="adult" onchange="app.toggleSlotRating()"> 成人向け</label>
                </div>

                <div class="slot-grid">
                    <div class="slot-item">
                        <div class="slot-label">季節</div>
                        <div class="slot-controls">
                            <div class="slot-result" id="slot-Kisetsu"></div>
                            <button class="slot-btn" onclick="app.spinSlot('Kisetsu')">🎰</button>
                        </div>
                    </div>

                    <div class="slot-item">
                        <div class="slot-label">時間帯</div>
                        <div class="slot-controls">
                            <div class="slot-result" id="slot-Jikan"></div>
                            <button class="slot-btn" onclick="app.spinSlot('Jikan')">🎰</button>
                        </div>
                    </div>

                    <div class="slot-item">
                        <div class="slot-label">天候</div>
                        <div class="slot-controls">
                            <div class="slot-result" id="slot-Tenkou"></div>
                            <button class="slot-btn" onclick="app.spinSlot('Tenkou')">🎰</button>
                        </div>
                    </div>

                    <div class="slot-item">
                        <div class="slot-label">場所</div>
                        <div class="slot-controls">
                            <div class="slot-result" id="slot-Basho"></div>
                            <button class="slot-btn" onclick="app.spinSlot('Basho')">🎰</button>
                        </div>
                    </div>

                    <div class="slot-item">
                        <div class="slot-label">ジャンル</div>
                        <div class="slot-controls">
                            <div class="slot-result" id="slot-Janru"></div>
                            <button class="slot-btn" onclick="app.spinSlot('Janru')">🎰</button>
                        </div>
                    </div>

                    <div class="slot-item">
                        <div class="slot-label">関係</div>
                        <div class="slot-controls">
                            <div class="slot-result" id="slot-Kankei"></div>
                            <button class="slot-btn" onclick="app.spinSlot('Kankei')">🎰</button>
                        </div>
                    </div>

                    <div class="slot-item">
                        <div class="slot-label">シチュエーション</div>
                        <div class="slot-controls">
                            <div class="slot-result" id="slot-Sichue"></div>
                            <button class="slot-btn" onclick="app.spinSlot('Sichue')">🎰</button>
                        </div>
                    </div>

                    <!-- 成人向け項目 -->
                    <div class="slot-item adult-section" id="slotAdultSection1">
                        <div class="slot-label">アイテム</div>
                        <div class="slot-controls">
                            <div class="slot-result" id="slot-Aitemo"></div>
                            <button class="slot-btn" onclick="app.spinSlot('Aitemo')">🎰</button>
                        </div>
                    </div>
                </div>

                <div class="slot-grid adult-section" id="slotAdultSection2" style="margin-top: 15px;">
                    <div class="slot-item">
                        <div class="slot-label">プレイA (前戯)</div>
                        <div class="slot-controls">
                            <div class="slot-result" id="slot-PureiA"></div>
                            <button class="slot-btn" onclick="app.spinSlot('PureiA')">🎰</button>
                        </div>
                    </div>

                    <div class="slot-item">
                        <div class="slot-label">プレイB (本番)</div>
                        <div class="slot-controls">
                            <div class="slot-result" id="slot-PureiB"></div>
                            <button class="slot-btn" onclick="app.spinSlot('PureiB')">🎰</button>
                        </div>
                    </div>

                    <div class="slot-item">
                        <div class="slot-label">プレイC (その他)</div>
                        <div class="slot-controls">
                            <div class="slot-result" id="slot-PureiC"></div>
                            <button class="slot-btn" onclick="app.spinSlot('PureiC')">🎰</button>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 20px; display: flex; gap: 10px;">
                    <button class="slot-action-btn" onclick="app.spinAllSlots()">全て回す</button>
                    <button class="slot-action-btn" onclick="app.clearAllSlots()">クリア</button>
                    <button class="slot-action-btn" style="background: #6b8b5a;" onclick="app.insertSlotToMemo()">メモに挿入</button>
                </div>
            </div>
        `;

        modal.appendChild(window);
        modal.className = 'slot-modal';
        document.body.appendChild(modal);

        // スロットデータを保存
        this._slotData = slotData;

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    },

    toggleSlotRating() {
        const isAdult = document.querySelector('input[name="slotRating"]:checked').value === 'adult';
        const adultSections = document.querySelectorAll('.adult-section');
        adultSections.forEach(section => {
            if (isAdult) {
                section.classList.add('show');
            } else {
                section.classList.remove('show');
                // 成人向け項目をクリア
                ['Aitemo', 'PureiA', 'PureiB', 'PureiC'].forEach(key => {
                    const elem = document.getElementById(`slot-${key}`);
                    if (elem) elem.textContent = '';
                });
            }
        });
    },

    spinSlot(category) {
        if (!this._slotData || !this._slotData[category]) return;
        
        const items = this._slotData[category];
        const randomItem = items[Math.floor(Math.random() * items.length)];
        
        const resultElem = document.getElementById(`slot-${category}`);
        if (resultElem) {
            resultElem.textContent = randomItem;
        }
    },

    spinAllSlots() {
        const isAdult = document.querySelector('input[name="slotRating"]:checked').value === 'adult';
        
        // 基本項目
        ['Kisetsu', 'Jikan', 'Tenkou', 'Basho', 'Janru', 'Kankei', 'Sichue'].forEach(key => {
            this.spinSlot(key);
        });
        
        // 成人向け項目
        if (isAdult) {
            ['Aitemo', 'PureiA', 'PureiB', 'PureiC'].forEach(key => {
                this.spinSlot(key);
            });
        }
    },

    clearAllSlots() {
        ['Kisetsu', 'Jikan', 'Tenkou', 'Basho', 'Janru', 'Kankei', 'Aitemo', 'Sichue', 'PureiA', 'PureiB', 'PureiC'].forEach(key => {
            const elem = document.getElementById(`slot-${key}`);
            if (elem) elem.textContent = '';
        });
    },

    insertSlotToMemo() {
        const isAdult = document.querySelector('input[name="slotRating"]:checked').value === 'adult';
        
        const getSlotValue = (key) => {
            const elem = document.getElementById(`slot-${key}`);
            return elem ? elem.textContent : '';
        };

        let result = `===== 創作支援スロット結果 (${isAdult ? '成人向け' : '全年齢'}) =====\n`;
        result += `作成日時: ${new Date().toLocaleString('ja-JP')}\n\n`;
        result += `【シーン設定】\n`;
        result += `季節: ${getSlotValue('Kisetsu')}\n`;
        result += `時間帯: ${getSlotValue('Jikan')}\n`;
        result += `天候: ${getSlotValue('Tenkou')}\n`;
        result += `場所: ${getSlotValue('Basho')}\n\n`;
        result += `【ストーリー要素】\n`;
        result += `ジャンル: ${getSlotValue('Janru')}\n`;
        result += `関係: ${getSlotValue('Kankei')}\n`;
        
        if (isAdult) {
            result += `アイテム: ${getSlotValue('Aitemo')}\n`;
        }
        
        result += `シチュエーション: ${getSlotValue('Sichue')}\n`;
        
        if (isAdult) {
            result += `\n【プレイ内容】\n`;
            result += `プレイA: ${getSlotValue('PureiA')}\n`;
            result += `プレイB: ${getSlotValue('PureiB')}\n`;
            result += `プレイC: ${getSlotValue('PureiC')}\n`;
        }
        
        result += `================================\n`;

        // メモに挿入
        const memoEditor = document.getElementById('memoEditor');
        const currentMemo = memoEditor.value;
        
        if (currentMemo) {
            memoEditor.value = currentMemo + '\n\n' + result;
        } else {
            memoEditor.value = result;
        }
        
        // メモを保存
        if (this.currentProject) {
            localStorage.setItem(`memo_${this.currentProject}`, memoEditor.value);
        }
        
        // モーダルを閉じる
        document.querySelector('.slot-modal').remove();
        
        this.showStatus('メモに挿入しました');
    },

    // =====================================================
    // 提供されたHTML版からの文字置換実装（完全版）
    // =====================================================
    openReplace() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const window = document.createElement('div');
        window.style.cssText = `
            background: #e7d0a9;
            border-radius: 20px;
            width: 90%;
            max-width: 600px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 60px rgba(0,0,0,0.4);
        `;

        window.innerHTML = `
            <style>
                .replace-input-group {
                    margin-bottom: 15px;
                }
                .replace-label {
                    font-size: 13px;
                    font-weight: bold;
                    color: #7c5b53;
                    margin-bottom: 5px;
                }
                .replace-textarea {
                    width: 100%;
                    height: 120px;
                    padding: 8px;
                    border: 1px solid #c4a88b;
                    border-radius: 8px;
                    font-family: 'MS Gothic', monospace;
                    font-size: 13px;
                    resize: vertical;
                }
                .replace-radio-group {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 15px;
                }
                .replace-result {
                    margin-top: 10px;
                    padding: 10px;
                    background: white;
                    border-radius: 8px;
                    font-size: 12px;
                    min-height: 40px;
                }
                .replace-btn {
                    padding: 10px 20px;
                    background: #7c5b53;
                    color: white;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 13px;
                    margin-right: 8px;
                }
                .replace-btn:hover {
                    background: #6a4d45;
                }
                .replace-help {
                    font-size: 11px;
                    color: #666;
                    margin-top: 5px;
                    line-height: 1.4;
                }
            </style>

            <!-- ヘッダー -->
            <div style="background: linear-gradient(to right, #7c5b53, #a0795f); color: white; padding: 18px 25px; display: flex; justify-content: space-between; align-items: center; border-radius: 20px 20px 0 0;">
                <div style="font-size: 20px; font-weight: bold;">🔄 文字置換</div>
                <button onclick="this.closest('.replace-modal').remove()" style="background: none; border: none; color: white; font-size: 28px; cursor: pointer; padding: 0 8px; line-height: 1;">×</button>
            </div>

            <!-- コンテンツ -->
            <div style="padding: 25px; background: white;">
                <div class="replace-input-group">
                    <div class="replace-label">置換前の文字列（1行に1つ）:</div>
                    <textarea id="replaceFromText" class="replace-textarea" placeholder="例：\n太郎\n花子\n次郎"></textarea>
                    <div class="replace-help">💡 複数の文字列を一度に置換できます。1行に1つずつ入力してください。</div>
                </div>

                <div class="replace-input-group">
                    <div class="replace-label">置換後の文字列（1行に1つ）:</div>
                    <textarea id="replaceToText" class="replace-textarea" placeholder="例：\n田中太郎\n佐藤花子\n鈴木次郎"></textarea>
                    <div class="replace-help">⚠️ 置換前と同じ行数を入力してください。行が対応していない場合はエラーになります。</div>
                </div>

                <div class="replace-radio-group">
                    <label><input type="radio" name="replaceRange" value="current" checked> 現在のトラックのみ</label>
                    <label><input type="radio" name="replaceRange" value="all"> プロジェクト全体</label>
                </div>

                <div class="replace-result" id="replaceResult"></div>

                <div style="margin-top: 20px;">
                    <button class="replace-btn" onclick="app.executeReplace()">置換実行</button>
                    <button class="replace-btn" style="background: #999;" onclick="this.closest('.replace-modal').remove()">キャンセル</button>
                </div>
            </div>
        `;

        modal.appendChild(window);
        modal.className = 'replace-modal';
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    },

    executeReplace() {
        const fromText = document.getElementById('replaceFromText').value;
        const toText = document.getElementById('replaceToText').value;
        const range = document.querySelector('input[name="replaceRange"]:checked').value;
        const resultDiv = document.getElementById('replaceResult');

        if (!fromText.trim()) {
            resultDiv.innerHTML = '<span style="color: orange;">⚠️ 置換前の文字列を入力してください。</span>';
            return;
        }

        // 行ごとに分割
        const fromLines = fromText.split('\n');
        const toLines = toText.split('\n');

        // 行数チェック
        if (fromLines.length !== toLines.length) {
            resultDiv.innerHTML = `<span style="color: red;">❌ エラー: 置換前（${fromLines.length}行）と置換後（${toLines.length}行）の行数が一致しません。</span>`;
            return;
        }

        // 置換ペアを作成
        const replacePairs = [];
        for (let i = 0; i < fromLines.length; i++) {
            if (fromLines[i]) {  // 空行も許可
                replacePairs.push({
                    from: fromLines[i],
                    to: toLines[i] || '' // 置換後が空でもOK
                });
            }
        }

        if (replacePairs.length === 0) {
            resultDiv.innerHTML = '<span style="color: orange;">⚠️ 有効な置換ペアがありません。</span>';
            return;
        }

        let totalReplacedCount = 0;
        let affectedTracks = 0;

        const sections = range === 'current' 
            ? [this.cuts[this.currentCut]]
            : this.cuts;

        sections.forEach((section, index) => {
            if (!section.content) return;
            
            let content = section.content;
            let sectionReplacedCount = 0;

            replacePairs.forEach(pair => {
                // 置換前に出現回数をカウント
                const regex = new RegExp(pair.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                const matches = content.match(regex);
                const count = matches ? matches.length : 0;
                
                if (count > 0) {
                    // 置換実行
                    content = content.split(pair.from).join(pair.to);
                    sectionReplacedCount += count;
                }
            });

            if (sectionReplacedCount > 0) {
                section.content = content;
                totalReplacedCount += sectionReplacedCount;
                affectedTracks++;

                // 現在のトラックなら画面も更新
                if (range === 'current' || index === this.currentCut) {
                    document.getElementById('contentEditor').value = content;
                    this.saveCutContent();
                    this.updateCharCount();
                }
            }
        });

        if (totalReplacedCount > 0) {
            const rangeText = range === 'current' ? '現在のトラック' : `${affectedTracks}個のトラック`;
            resultDiv.innerHTML = `<span style="color: green; font-weight: bold;">✓ ${rangeText}で ${totalReplacedCount} 箇所を置換しました。</span>`;
            this.showStatus(`${rangeText}で ${totalReplacedCount} 箇所を置換しました`);
        } else {
            resultDiv.innerHTML = '<span style="color: orange;">該当する文字列が見つかりませんでした。</span>';
        }
    },

    // =====================================================
    // 提供されたHTML版からの台詞連番実装（完全版）
    // =====================================================
    openDialogueNumbers() {
        const editor = document.getElementById('contentEditor');
        const currentText = editor.value;

        if (!currentText) {
            alert('テキストが入力されていません。');
            return;
        }

        try {
            // 既存の連番を削除して最初の番号を記録
            const regexLeadingNumber = /^\s*(\d{3})\s+/;
            let lines = currentText.split('\n');
            let firstNumber = null;

            // 既存の連番を削除し、最初の番号を取得
            for (let i = 0; i < lines.length; i++) {
                const match = lines[i].match(regexLeadingNumber);
                if (match && !firstNumber) {
                    firstNumber = parseInt(match[1]);
                }
                lines[i] = lines[i].replace(regexLeadingNumber, '');
            }

            // 台詞の正規表現パターン
            const regexA_NameColon = /^\s*[^：\r\n]+：/;      // 名前：形式
            const regexB_NameOpenQ = /^\s*[^「\r\n]+「/;       // 名前「形式
            const regexC_HashWord = /^\s*＃\S+/;               // ＃名前形式

            let counter = firstNumber || 1;
            let dialogCount = 0;

            // 台詞に連番を付与
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                const isDialog = 
                    regexA_NameColon.test(line) ||
                    regexB_NameOpenQ.test(line) ||
                    regexC_HashWord.test(line);

                if (isDialog) {
                    lines[i] = String(counter).padStart(3, '0') + ' ' + line;
                    counter++;
                    dialogCount++;
                }
            }

            // 結果を反映
            const result = lines.join('\n');
            editor.value = result;
            
            this.saveCutContent();
            this.updateCharCount();

            const startMsg = firstNumber ? `（${String(firstNumber).padStart(3, '0')}から開始）` : '（001から開始）';
            this.showStatus(`台詞に連番を付与しました。${startMsg} 台詞数: ${dialogCount}件`);

        } catch (ex) {
            alert(`台詞連番付与中にエラーが発生しました: ${ex.message}`);
        }
    },

    pickDate() {
        this.showCalendarDialog();
    },

    showCalendarDialog() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const window = document.createElement('div');
        window.style.cssText = `
            background: #e7d0a9;
            border-radius: 20px;
            width: 90%;
            max-width: 400px;
            overflow: hidden;
            box-shadow: 0 10px 60px rgba(0,0,0,0.4);
        `;

        // 現在の日付または既存の日付を取得
        let currentDate = new Date();
        const existingDate = document.getElementById('deadlineDate').value;
        if (existingDate) {
            const parsed = new Date(existingDate);
            if (!isNaN(parsed)) {
                currentDate = parsed;
            }
        }

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        window.innerHTML = `
            <style>
                .calendar-header {
                    background: linear-gradient(to right, #7c5b53, #a0795f);
                    color: white;
                    padding: 18px 25px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .calendar-nav {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 15px 20px;
                    background: white;
                }
                .calendar-nav-btn {
                    background: #7c5b53;
                    color: white;
                    border: none;
                    padding: 8px 15px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                }
                .calendar-nav-btn:hover {
                    background: #6a4d45;
                }
                .calendar-month-year {
                    font-size: 18px;
                    font-weight: bold;
                    color: #7c5b53;
                }
                .calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 5px;
                    padding: 15px 20px 20px 20px;
                    background: white;
                }
                .calendar-day-header {
                    text-align: center;
                    font-weight: bold;
                    color: #7c5b53;
                    padding: 8px;
                    font-size: 12px;
                }
                .calendar-day {
                    aspect-ratio: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s;
                }
                .calendar-day:hover {
                    background: #e7d0a9;
                }
                .calendar-day.other-month {
                    color: #ccc;
                }
                .calendar-day.today {
                    background: #d4b89b;
                    font-weight: bold;
                }
                .calendar-day.selected {
                    background: #7c5b53;
                    color: white;
                    font-weight: bold;
                }
            </style>

            <div class="calendar-header">
                <div style="font-size: 20px; font-weight: bold;">📅 執筆期日を選択</div>
                <button onclick="this.closest('.calendar-modal').remove()" style="background: none; border: none; color: white; font-size: 28px; cursor: pointer; padding: 0 8px; line-height: 1;">×</button>
            </div>

            <div class="calendar-nav">
                <button class="calendar-nav-btn" onclick="app.changeCalendarMonth(-1)">◀</button>
                <div class="calendar-month-year" id="calendarMonthYear"></div>
                <button class="calendar-nav-btn" onclick="app.changeCalendarMonth(1)">▶</button>
            </div>

            <div class="calendar-grid" id="calendarGrid"></div>
        `;

        modal.appendChild(window);
        modal.className = 'calendar-modal';
        document.body.appendChild(modal);

        // カレンダーの状態を保持
        this._calendarState = {
            year: year,
            month: month,
            selectedDate: currentDate
        };

        this.renderCalendar();

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    },

    changeCalendarMonth(delta) {
        this._calendarState.month += delta;
        if (this._calendarState.month < 0) {
            this._calendarState.month = 11;
            this._calendarState.year--;
        } else if (this._calendarState.month > 11) {
            this._calendarState.month = 0;
            this._calendarState.year++;
        }
        this.renderCalendar();
    },

    renderCalendar() {
        const { year, month, selectedDate } = this._calendarState;
        
        // 月年表示を更新
        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
        document.getElementById('calendarMonthYear').textContent = `${year}年 ${monthNames[month]}`;

        // カレンダーグリッドを生成
        const grid = document.getElementById('calendarGrid');
        grid.innerHTML = '';

        // 曜日ヘッダー
        const dayHeaders = ['日', '月', '火', '水', '木', '金', '土'];
        dayHeaders.forEach(day => {
            const header = document.createElement('div');
            header.className = 'calendar-day-header';
            header.textContent = day;
            grid.appendChild(header);
        });

        // 月の最初の日と最後の日
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const firstDayOfWeek = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        // 前月の日付
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const day = document.createElement('div');
            day.className = 'calendar-day other-month';
            day.textContent = prevMonthLastDay - i;
            grid.appendChild(day);
        }

        // 今月の日付
        const today = new Date();
        for (let i = 1; i <= daysInMonth; i++) {
            const day = document.createElement('div');
            day.className = 'calendar-day';
            day.textContent = i;

            const currentDay = new Date(year, month, i);
            
            // 今日
            if (currentDay.toDateString() === today.toDateString()) {
                day.classList.add('today');
            }

            // 選択された日付
            if (selectedDate && currentDay.toDateString() === selectedDate.toDateString()) {
                day.classList.add('selected');
            }

            day.onclick = () => this.selectCalendarDate(year, month, i);
            grid.appendChild(day);
        }

        // 来月の日付
        const remainingDays = 42 - (firstDayOfWeek + daysInMonth);
        for (let i = 1; i <= remainingDays; i++) {
            const day = document.createElement('div');
            day.className = 'calendar-day other-month';
            day.textContent = i;
            grid.appendChild(day);
        }
    },

    selectCalendarDate(year, month, day) {
        const selectedDate = new Date(year, month, day);
        
        // 日本語の曜日
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        const dayOfWeek = dayNames[selectedDate.getDay()];
        
        // yyyy/MM/dd(曜日) 形式
        const dateString = `${year}/${String(month + 1).padStart(2, '0')}/${String(day).padStart(2, '0')}(${dayOfWeek})`;
        
        document.getElementById('deadlineDate').value = dateString;
        
        // モーダルを閉じる
        document.querySelector('.calendar-modal').remove();
        
        this.showStatus('期日を設定しました');
    },

    // ============================================================
    // 分析機能 - Windows版完全移植
    // ============================================================
    showAnalysis() {
        this.displayAnalysisWindow();
    },

    displayAnalysisWindow() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const window = document.createElement('div');
        window.style.cssText = `
            background: #e7d0a9;
            border-radius: 20px;
            width: 95%;
            max-width: 1100px;
            max-height: 90vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 60px rgba(0,0,0,0.4);
        `;

        window.innerHTML = `
            <style>
                .analysis-tab-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }
                .analysis-tabs {
                    display: flex;
                    background: #d4b89b;
                    padding: 10px 15px 0 15px;
                    gap: 5px;
                }
                .analysis-tab {
                    padding: 12px 24px;
                    background: #b3967d;
                    color: white;
                    border: none;
                    border-radius: 12px 12px 0 0;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: bold;
                    transition: all 0.2s;
                }
                .analysis-tab:hover {
                    background: #9d8366;
                }
                .analysis-tab.active {
                    background: white;
                    color: #7c5b53;
                }
                .analysis-tab-content {
                    display: none;
                    padding: 20px;
                    background: white;
                    overflow-y: auto;
                    flex: 1;
                }
                .analysis-tab-content.active {
                    display: block;
                }
                .stat-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 12px;
                    margin-bottom: 20px;
                }
                .stat-card {
                    background: linear-gradient(135deg, #7c5b53 0%, #a0795f 100%);
                    color: white;
                    padding: 15px;
                    border-radius: 12px;
                    text-align: center;
                }
                .stat-label {
                    font-size: 11px;
                    color: #e7d0a9;
                    margin-bottom: 5px;
                }
                .stat-value {
                    font-size: 26px;
                    font-weight: bold;
                }
                .stat-unit {
                    font-size: 13px;
                    color: #e7d0a9;
                }
                .char-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                    font-size: 12px;
                }
                .char-table th {
                    background: #7c5b53;
                    color: white;
                    padding: 10px;
                    text-align: left;
                    font-weight: bold;
                }
                .char-table td {
                    padding: 8px 10px;
                    border-bottom: 1px solid #e0e0e0;
                }
                .char-table tr:nth-child(even) {
                    background: #f9f9f9;
                }
                .char-table tr:hover {
                    background: #e7d0a9;
                }
                .analysis-section-title {
                    font-size: 16px;
                    font-weight: bold;
                    color: #7c5b53;
                    margin: 20px 0 10px 0;
                    padding-bottom: 8px;
                    border-bottom: 2px solid #e7d0a9;
                }
                .analysis-export-btn {
                    padding: 10px 20px;
                    background: #7c5b53;
                    color: white;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 13px;
                    margin-right: 8px;
                }
                .analysis-export-btn:hover {
                    background: #6a4d45;
                }
                .voice-request-preview {
                    background: #f9f9f9;
                    padding: 15px;
                    border-radius: 10px;
                    font-family: 'MS Gothic', monospace;
                    font-size: 12px;
                    white-space: pre-wrap;
                    max-height: 400px;
                    overflow-y: auto;
                }
                .sound-effect-list {
                    background: #f9f9f9;
                    padding: 15px;
                    border-radius: 10px;
                    font-family: 'MS Gothic', monospace;
                    font-size: 12px;
                    white-space: pre-wrap;
                    max-height: 450px;
                    overflow-y: auto;
                }
                .analysis-input-group {
                    display: grid;
                    grid-template-columns: 150px 1fr;
                    gap: 10px;
                    align-items: center;
                    margin-bottom: 12px;
                }
                .analysis-input-label {
                    font-size: 13px;
                    font-weight: bold;
                    color: #7c5b53;
                }
                .analysis-input {
                    padding: 8px;
                    border: 1px solid #c4a88b;
                    border-radius: 8px;
                    font-size: 13px;
                }
                .analysis-radio-group {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 15px;
                }
            </style>

            <!-- ヘッダー -->
            <div style="background: linear-gradient(to right, #7c5b53, #a0795f); color: white; padding: 18px 25px; display: flex; justify-content: space-between; align-items: center; border-radius: 20px 20px 0 0;">
                <div style="font-size: 20px; font-weight: bold;">📊 シナリオ分析ツール</div>
                <button onclick="this.closest('.analysis-modal').remove()" style="background: none; border: none; color: white; font-size: 28px; cursor: pointer; padding: 0 8px; line-height: 1;">×</button>
            </div>

            <!-- タブナビゲーション -->
            <div class="analysis-tab-container">
                <div class="analysis-tabs">
                    <button class="analysis-tab active" onclick="app.switchAnalysisTab(0)">文字数計算</button>
                    <button class="analysis-tab" onclick="app.switchAnalysisTab(1)">声優依頼文</button>
                    <button class="analysis-tab" onclick="app.switchAnalysisTab(2)">音声効果</button>
                    <button class="analysis-tab" onclick="app.switchAnalysisTab(3)">シーン管理</button>
                </div>

                <!-- タブ1: 文字数計算 -->
                <div class="analysis-tab-content active" id="analysis-tab-0">
                    <div class="analysis-radio-group">
                        <label><input type="radio" name="targetRange" value="current" checked> 現在のトラック</label>
                        <label><input type="radio" name="targetRange" value="all"> 全トラック</label>
                    </div>
                    <div class="analysis-input-group">
                        <div class="analysis-input-label">単価（円/文字）:</div>
                        <input type="number" class="analysis-input" id="charPriceInput" value="1" min="0" step="0.01">
                    </div>
                    <button class="analysis-export-btn" onclick="app.calculateCharStats()">計算</button>
                    
                    <div class="stat-grid" id="charStatsGrid"></div>
                    <div id="charStatsTable"></div>
                    
                    <div style="margin-top: 20px;">
                        <button class="analysis-export-btn" onclick="app.exportCharStatsTxt()">📄 テキスト保存</button>
                        <button class="analysis-export-btn" onclick="app.exportCharStatsCsv()">📊 CSV保存</button>
                    </div>
                </div>

                <!-- タブ2: 声優依頼文 -->
                <div class="analysis-tab-content" id="analysis-tab-1">
                    <div class="analysis-input-group">
                        <div class="analysis-input-label">声優単価（円/文字）:</div>
                        <input type="number" class="analysis-input" id="voicePriceInput" value="1" min="0" step="0.01">
                    </div>
                    <div class="analysis-input-group">
                        <div class="analysis-input-label">締め切り日:</div>
                        <input type="date" class="analysis-input" id="voiceDeadlineInput">
                    </div>
                    <div class="analysis-input-group">
                        <div class="analysis-input-label">支払日:</div>
                        <input type="date" class="analysis-input" id="voicePaymentInput">
                    </div>
                    <button class="analysis-export-btn" onclick="app.generateVoiceRequest()">依頼文生成</button>
                    
                    <div class="voice-request-preview" id="voiceRequestPreview"></div>
                    
                    <div style="margin-top: 20px;">
                        <button class="analysis-export-btn" onclick="app.exportVoiceRequest()">📄 テキスト保存</button>
                    </div>
                </div>

                <!-- タブ3: 音声効果 -->
                <div class="analysis-tab-content" id="analysis-tab-2">
                    <button class="analysis-export-btn" onclick="app.extractSoundEffects()">抽出</button>
                    
                    <div class="stat-grid" id="soundEffectStatsGrid"></div>
                    <div class="sound-effect-list" id="soundEffectList"></div>
                    
                    <div style="margin-top: 20px;">
                        <button class="analysis-export-btn" onclick="app.exportSoundEffects()">📄 テキスト保存</button>
                    </div>
                </div>

                <!-- タブ4: シーン管理 -->
                <div class="analysis-tab-content" id="analysis-tab-3">
                    <button class="analysis-export-btn" onclick="app.extractSceneManagement()">抽出</button>
                    
                    <div class="stat-grid" id="sceneStatsGrid"></div>
                    <div class="sound-effect-list" id="sceneManagementList"></div>
                    
                    <div style="margin-top: 20px;">
                        <button class="analysis-export-btn" onclick="app.exportSceneManagement()">📄 テキスト保存</button>
                    </div>
                </div>
            </div>

            <!-- フッター -->
            <div style="background: #d4b89b; padding: 15px 25px; display: flex; justify-content: flex-end; gap: 10px; border-radius: 0 0 20px 20px;">
                <button class="analysis-export-btn" onclick="this.closest('.analysis-modal').remove()">閉じる</button>
            </div>
        `;

        modal.appendChild(window);
        modal.className = 'analysis-modal';
        document.body.appendChild(modal);

        // デフォルト日付設定
        const today = new Date();
        const deadline = new Date(today);
        deadline.setDate(deadline.getDate() + 14);
        const payment = new Date(today);
        payment.setDate(payment.getDate() + 21);
        
        document.getElementById('voiceDeadlineInput').value = deadline.toISOString().split('T')[0];
        document.getElementById('voicePaymentInput').value = payment.toISOString().split('T')[0];

        // 初期計算
        this.calculateCharStats();

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    },

    switchAnalysisTab(index) {
        const tabs = document.querySelectorAll('.analysis-tab');
        const contents = document.querySelectorAll('.analysis-tab-content');
        
        tabs.forEach((tab, i) => {
            if (i === index) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        contents.forEach((content, i) => {
            if (i === index) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    },

    // 文字数計算
    calculateCharStats() {
        const charPrice = parseFloat(document.getElementById('charPriceInput').value) || 1;
        const targetRange = document.querySelector('input[name="targetRange"]:checked').value;
        
        const charDict = {};
        const sections = targetRange === 'current' 
            ? [this.cuts[this.currentCut]]
            : this.cuts;

        sections.forEach(section => {
            if (!section.content) return;
            
            const lines = section.content.split('\n');
            let pendingCharName = null;

            lines.forEach(line => {
                const trimmed = line.trim();
                const lineWithoutNumber = trimmed.replace(/^\d{3}\s+/, '').trim();

                // ☆効果音、☆BGM、☆環境音はスキップ
                if (lineWithoutNumber.startsWith('☆効果音') ||
                    lineWithoutNumber.startsWith('☆BGM') ||
                    lineWithoutNumber.startsWith('☆環境音')) {
                    return;
                }

                if (pendingCharName) {
                    if (lineWithoutNumber) {
                        if (!charDict[pendingCharName]) charDict[pendingCharName] = 0;
                        charDict[pendingCharName] += lineWithoutNumber.length;
                    }
                    pendingCharName = null;
                    return;
                }

                let charName = null;
                let dialogue = null;

                if (lineWithoutNumber.includes('：')) {
                    const colonIndex = lineWithoutNumber.indexOf('：');
                    charName = lineWithoutNumber.substring(0, colonIndex).trim();
                    dialogue = lineWithoutNumber.substring(colonIndex + 1).trim();
                } else if (lineWithoutNumber.match(/^([^「]+)「(.+)」$/)) {
                    const match = lineWithoutNumber.match(/^([^「]+)「(.+)」$/);
                    charName = match[1].trim();
                    dialogue = match[2];
                } else if (lineWithoutNumber.startsWith('＃')) {
                    pendingCharName = lineWithoutNumber.substring(1).trim();
                    return;
                }

                if (charName && dialogue) {
                    if (!charDict[charName]) charDict[charName] = 0;
                    charDict[charName] += dialogue.length;
                }
            });
        });

        // 統計計算
        const totalChars = Object.values(charDict).reduce((sum, count) => sum + count, 0);
        const totalPrice = totalChars * charPrice;
        const charCount = Object.keys(charDict).length;

        // グリッド表示
        const grid = document.getElementById('charStatsGrid');
        grid.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">総文字数</div>
                <div class="stat-value">${totalChars.toLocaleString()}<span class="stat-unit">文字</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">キャラクター数</div>
                <div class="stat-value">${charCount}<span class="stat-unit">人</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">合計金額</div>
                <div class="stat-value">¥${totalPrice.toLocaleString()}</div>
            </div>
        `;

        // テーブル表示
        let tableHtml = '<table class="char-table"><thead><tr><th>キャラクター名</th><th>文字数</th><th>金額</th></tr></thead><tbody>';
        
        Object.entries(charDict)
            .sort((a, b) => b[1] - a[1])
            .forEach(([name, count]) => {
                const price = count * charPrice;
                tableHtml += `<tr><td><strong>${name}</strong></td><td>${count.toLocaleString()}文字</td><td>¥${price.toLocaleString()}</td></tr>`;
            });
        
        tableHtml += '</tbody></table>';
        document.getElementById('charStatsTable').innerHTML = tableHtml;

        // データを保存
        this._currentCharStats = { charDict, totalChars, totalPrice, charCount, charPrice };
    },

    // 声優依頼文生成
    generateVoiceRequest() {
        const voicePrice = parseFloat(document.getElementById('voicePriceInput').value) || 1;
        const deadline = document.getElementById('voiceDeadlineInput').value;
        const payment = document.getElementById('voicePaymentInput').value;

        const charDict = {};
        const lineNumbers = {};

        this.cuts.forEach((section, sectionIndex) => {
            if (!section.content) return;
            
            const lines = section.content.split('\n');
            let lineNumber = 1;
            let pendingCharName = null;

            lines.forEach(line => {
                const trimmed = line.trim();
                const lineWithoutNumber = trimmed.replace(/^\d{3}\s+/, '').trim();

                if (lineWithoutNumber.startsWith('☆効果音') ||
                    lineWithoutNumber.startsWith('☆BGM') ||
                    lineWithoutNumber.startsWith('☆環境音')) {
                    return;
                }

                const hasNumber = /^\d{3}\s+/.test(trimmed);

                if (pendingCharName && hasNumber) {
                    if (lineWithoutNumber) {
                        if (!charDict[pendingCharName]) {
                            charDict[pendingCharName] = 0;
                            lineNumbers[pendingCharName] = [];
                        }
                        charDict[pendingCharName] += lineWithoutNumber.length;
                        lineNumbers[pendingCharName].push(String(lineNumber).padStart(3, '0'));
                    }
                    pendingCharName = null;
                }

                if (hasNumber) {
                    let charName = null;
                    let dialogue = null;

                    if (lineWithoutNumber.includes('：')) {
                        const colonIndex = lineWithoutNumber.indexOf('：');
                        charName = lineWithoutNumber.substring(0, colonIndex).trim();
                        dialogue = lineWithoutNumber.substring(colonIndex + 1).trim();
                    } else if (lineWithoutNumber.match(/^([^「]+)「(.+)」$/)) {
                        const match = lineWithoutNumber.match(/^([^「]+)「(.+)」$/);
                        charName = match[1].trim();
                        dialogue = match[2];
                    } else if (lineWithoutNumber.startsWith('＃')) {
                        pendingCharName = lineWithoutNumber.substring(1).trim();
                    }

                    if (charName && dialogue) {
                        if (!charDict[charName]) {
                            charDict[charName] = 0;
                            lineNumbers[charName] = [];
                        }
                        charDict[charName] += dialogue.length;
                        lineNumbers[charName].push(String(lineNumber).padStart(3, '0'));
                    }

                    lineNumber++;
                }
            });
        });

        // 依頼文生成（C#版と同じテンプレート）
        let request = 'お世話になっております。\n\n';
        request += 'この度、音声収録のご案内をさせていただきたく連絡いたしました。\n';
        request += '下記の内容にて収録の上、ご提出いただけますと幸いです。\n\n';
        request += '【ご依頼内容】\n';
        request += '━━━━━━━━━━━━━━━━━━━━━\n\n';
        
        Object.entries(charDict)
            .sort((a, b) => b[1] - a[1])
            .forEach(([name, count]) => {
                const price = count * voicePrice;
                const lines = lineNumbers[name] || [];
                
                request += `■ キャラクター名\n`;
                request += `  ${name}\n\n`;
                request += `■ 収録文字数\n`;
                request += `  ${count.toLocaleString()}文字\n\n`;
                
                if (lines.length > 0) {
                    request += `■ 収録対象セリフ番号\n`;
                    lines.forEach(line => {
                        request += `  ${line}\n`;
                    });
                    request += '\n';
                }
                
                request += `■ お支払い金額\n`;
                request += `  ¥${price.toLocaleString()}（単価：¥${voicePrice}/文字）\n\n`;
            });

        request += `■ 納品期限\n`;
        request += `  ${deadline}まで\n\n`;
        request += `■ お支払い期日\n`;
        request += `  ${payment}\n`;
        request += `  ※納品確認後、上記期日までにお支払いいたします\n\n`;
        request += `■ 音声形式\n`;
        request += `  ・サンプリングレート：48000Hz\n`;
        request += `  ・ビット深度：16bit\n`;
        request += `  ・チャンネル：モノラル\n`;
        request += `  ・ファイル形式：wav\n\n`;
        request += `■ 納品方法\n`;
        request += `  ギガファイル便での提出をお願いいたします。\n\n`;
        request += `■ 納品フォルダ名\n`;
        request += `  音声ファイル\n\n`;
        request += `■ ファイル命名規則\n`;
        request += `  「セリフ番号_キャラクター名.wav」の形式でお願いいたします。\n`;
        request += `  例：001_キャラクター名.wav\n\n`;
        request += '━━━━━━━━━━━━━━━━━━━━━\n\n';
        request += '【収録にあたってのお願い】\n';
        request += '・ノイズが入らない静かな環境での収録をお願いいたします。\n';
        request += '・各ファイルの冒頭と末尾に0.5秒程度の無音部分を入れてください。\n';
        request += '・リテイクがある場合は別ファイルとして保存してください。\n\n';
        request += 'ご不明な点がございましたら、お気軽にお問い合わせください。\n';
        request += 'お忙しいところ恐れ入りますが、ご確認のほどよろしくお願いいたします。\n\n';
        request += '何卒よろしくお願いいたします。';

        document.getElementById('voiceRequestPreview').textContent = request;
        this._currentVoiceRequest = request;
    },

    // 音声効果抽出
    extractSoundEffects() {
        const effects = {
            soundEffects: [],
            bgm: [],
            ambient: [],
            adult: [],
            currentLocation: []
        };

        this.cuts.forEach((section, index) => {
            if (!section.content) return;
            
            const lines = section.content.split('\n');

            lines.forEach(line => {
                const trimmed = line.trim();
                const match = trimmed.match(/^(\d{3})\s+(.*)/);
                let lineNumber = null;
                let lineWithoutNumber = trimmed;

                if (match) {
                    lineNumber = match[1];
                    lineWithoutNumber = match[2].trim();
                }

                let effectText = null;
                let effectType = null;

                // ♡で始まる（アダルト効果音）
                if (lineWithoutNumber.startsWith('♡')) {
                    effectText = lineWithoutNumber.substring(1).replace(/\/+$/, '').trim();
                    effectType = 'adult';
                }
                // ☆効果音//
                else if (lineWithoutNumber.startsWith('☆効果音//')) {
                    effectText = lineWithoutNumber.substring('☆効果音//'.length).trim();
                    effectType = 'soundEffect';
                }
                // ☆BGM//
                else if (lineWithoutNumber.startsWith('☆BGM//')) {
                    effectText = lineWithoutNumber.substring('☆BGM//'.length).trim();
                    effectType = 'bgm';
                }
                // ☆環境音//
                else if (lineWithoutNumber.startsWith('☆環境音//')) {
                    effectText = lineWithoutNumber.substring('☆環境音//'.length).trim();
                    effectType = 'ambient';
                }
                // 〇で始まる（現在地）
                else if (lineWithoutNumber.startsWith('〇 ')) {
                    effectText = lineWithoutNumber.substring('〇 '.length).trim();
                    effectType = 'currentLocation';
                }
                // 旧形式のサポート（互換性のため）
                else if (lineWithoutNumber.startsWith('☆効果音')) {
                    effectText = lineWithoutNumber.substring('☆効果音'.length).replace(/^[：:]/, '').trim();
                    effectType = 'soundEffect';
                }
                else if (lineWithoutNumber.startsWith('☆BGM')) {
                    effectText = lineWithoutNumber.substring('☆BGM'.length).replace(/^[：:]/, '').trim();
                    effectType = 'bgm';
                }
                else if (lineWithoutNumber.startsWith('☆環境音')) {
                    effectText = lineWithoutNumber.substring('☆環境音'.length).replace(/^[：:]/, '').trim();
                    effectType = 'ambient';
                }
                // ※現在地の形式もサポート
                else if (lineWithoutNumber.startsWith('※現在地')) {
                    effectText = lineWithoutNumber.substring('※現在地'.length).replace(/^[：:]/, '').trim();
                    effectType = 'currentLocation';
                }

                if (effectType) {
                    const effectData = {
                        track: section.name,
                        line: lineNumber || '',
                        content: effectText || lineWithoutNumber,
                        type: effectType
                    };

                    switch (effectType) {
                        case 'soundEffect':
                            effects.soundEffects.push(effectData);
                            break;
                        case 'bgm':
                            effects.bgm.push(effectData);
                            break;
                        case 'ambient':
                            effects.ambient.push(effectData);
                            break;
                        case 'adult':
                            effects.adult.push(effectData);
                            break;
                        case 'currentLocation':
                            effects.currentLocation.push(effectData);
                            break;
                    }
                }
            });
        });

        // 統計表示
        const total = effects.soundEffects.length + effects.bgm.length + effects.ambient.length + effects.adult.length;
        const grid = document.getElementById('soundEffectStatsGrid');
        grid.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">合計</div>
                <div class="stat-value">${total}<span class="stat-unit">件</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">効果音</div>
                <div class="stat-value">${effects.soundEffects.length}<span class="stat-unit">件</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">BGM</div>
                <div class="stat-value">${effects.bgm.length}<span class="stat-unit">件</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">環境音</div>
                <div class="stat-value">${effects.ambient.length}<span class="stat-unit">件</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">アダルト効果音</div>
                <div class="stat-value">${effects.adult.length}<span class="stat-unit">件</span></div>
            </div>
        `;

        // リスト表示（C#版と同じフォーマット）
        let list = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        list += '■ トラック別音声効果リスト\n';
        list += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        list += `出力日時：${new Date().toLocaleString('ja-JP')}\n\n`;

        // トラックごとにグループ化
        const trackGroups = {};
        [...effects.soundEffects, ...effects.bgm, ...effects.ambient, ...effects.adult].forEach(e => {
            if (!trackGroups[e.track]) {
                trackGroups[e.track] = {
                    soundEffects: [],
                    bgm: [],
                    ambient: [],
                    adult: []
                };
            }
            
            switch (e.type) {
                case 'soundEffect':
                    trackGroups[e.track].soundEffects.push(e);
                    break;
                case 'bgm':
                    trackGroups[e.track].bgm.push(e);
                    break;
                case 'ambient':
                    trackGroups[e.track].ambient.push(e);
                    break;
                case 'adult':
                    trackGroups[e.track].adult.push(e);
                    break;
            }
        });

        // トラックごとに表示
        Object.keys(trackGroups).sort().forEach(track => {
            const group = trackGroups[track];
            list += `【${track}】\n\n`;

            // 効果音
            if (group.soundEffects.length > 0) {
                list += '  ◆効果音\n';
                group.soundEffects.forEach((e, i) => {
                    const lineInfo = e.line ? `[連番:${e.line}] ` : '';
                    list += `    ${i + 1}. ${lineInfo}${e.content}\n`;
                });
                list += '\n';
            }

            // 環境音
            if (group.ambient.length > 0) {
                list += '  ◆環境音\n';
                group.ambient.forEach((e, i) => {
                    const lineInfo = e.line ? `[連番:${e.line}] ` : '';
                    list += `    ${i + 1}. ${lineInfo}${e.content}\n`;
                });
                list += '\n';
            }

            // アダルト効果音
            if (group.adult.length > 0) {
                list += '  ◆アダルト効果音\n';
                group.adult.forEach((e, i) => {
                    const lineInfo = e.line ? `[連番:${e.line}] ` : '';
                    list += `    ${i + 1}. ${lineInfo}${e.content}\n`;
                });
                list += '\n';
            }

            // BGM
            if (group.bgm.length > 0) {
                list += '  ◆BGM\n';
                group.bgm.forEach((e, i) => {
                    const lineInfo = e.line ? `[連番:${e.line}] ` : '';
                    list += `    ${i + 1}. ${lineInfo}${e.content}\n`;
                });
                list += '\n';
            }

            list += '\n';
        });

        if (total === 0) {
            list += '（音声効果が見つかりませんでした）\n';
        }

        document.getElementById('soundEffectList').textContent = list;
        this._currentSoundEffects = list;
    },

    // シーン管理抽出
    extractSceneManagement() {
        const locations = [];

        this.cuts.forEach((section, index) => {
            if (!section.content) return;
            
            const lines = section.content.split('\n');

            lines.forEach(line => {
                const trimmed = line.trim();
                const match = trimmed.match(/^(\d{3})\s+(.*)/);
                let lineNumber = null;
                let lineWithoutNumber = trimmed;

                if (match) {
                    lineNumber = match[1];
                    lineWithoutNumber = match[2].trim();
                }

                // 〇 で始まる行（現在地）
                if (lineWithoutNumber.startsWith('〇 ')) {
                    const locationText = lineWithoutNumber.substring('〇 '.length).trim();
                    locations.push({
                        track: section.name,
                        line: lineNumber || '',
                        content: locationText
                    });
                }
            });
        });

        // 統計表示
        const grid = document.getElementById('sceneStatsGrid');
        grid.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">現在地</div>
                <div class="stat-value">${locations.length}<span class="stat-unit">件</span></div>
            </div>
        `;

        // リスト表示
        let list = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        list += '■ シーン管理リスト\n';
        list += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        list += `出力日時：${new Date().toLocaleString('ja-JP')}\n\n`;

        if (locations.length > 0) {
            // トラックごとにグループ化
            const trackGroups = {};
            locations.forEach(loc => {
                if (!trackGroups[loc.track]) {
                    trackGroups[loc.track] = [];
                }
                trackGroups[loc.track].push(loc);
            });

            // トラックごとに表示
            Object.keys(trackGroups).sort().forEach(track => {
                list += `【${track}】\n\n`;
                trackGroups[track].forEach((loc, i) => {
                    const lineInfo = loc.line ? `[連番:${loc.line}] ` : '';
                    list += `  ${i + 1}. ${lineInfo}${loc.content}\n`;
                });
                list += '\n';
            });
        } else {
            list += '（現在地情報が見つかりませんでした）\n';
        }

        document.getElementById('sceneManagementList').textContent = list;
        this._currentSceneManagement = list;
    },

    // エクスポート関数群
    exportCharStatsTxt() {
        if (!this._currentCharStats) {
            alert('先に計算を実行してください');
            return;
        }

        const { charDict, totalChars, totalPrice, charCount, charPrice } = this._currentCharStats;
        
        let txt = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        txt += '■ 文字数計算結果\n';
        txt += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        txt += `出力日時: ${new Date().toLocaleString('ja-JP')}\n\n`;
        txt += `総文字数: ${totalChars.toLocaleString()}文字\n`;
        txt += `キャラクター数: ${charCount}人\n`;
        txt += `合計金額: ¥${totalPrice.toLocaleString()}\n\n`;
        txt += '【キャラクター別詳細】\n';
        
        Object.entries(charDict)
            .sort((a, b) => b[1] - a[1])
            .forEach(([name, count]) => {
                const price = count * charPrice;
                txt += `${name}: ${count.toLocaleString()}文字 (¥${price.toLocaleString()})\n`;
            });

        this.downloadFile(txt, `文字数計算_${Date.now()}.txt`, 'text/plain');
    },

    exportCharStatsCsv() {
        if (!this._currentCharStats) {
            alert('先に計算を実行してください');
            return;
        }

        const { charDict, totalChars, totalPrice, charPrice } = this._currentCharStats;
        
        let csv = 'キャラクター名,文字数,単価,金額\n';
        
        Object.entries(charDict)
            .sort((a, b) => b[1] - a[1])
            .forEach(([name, count]) => {
                const price = count * charPrice;
                csv += `${name},${count},${charPrice},${price}\n`;
            });
        
        csv += `\n合計,${totalChars},,${totalPrice}\n`;

        this.downloadFile(csv, `文字数計算_${Date.now()}.csv`, 'text/csv');
    },

    exportVoiceRequest() {
        if (!this._currentVoiceRequest) {
            alert('先に依頼文を生成してください');
            return;
        }
        this.downloadFile(this._currentVoiceRequest, `声優依頼文_${Date.now()}.txt`, 'text/plain');
    },

    exportSoundEffects() {
        if (!this._currentSoundEffects) {
            alert('先に抽出を実行してください');
            return;
        }
        this.downloadFile(this._currentSoundEffects, `音声効果リスト_${Date.now()}.txt`, 'text/plain');
    },

    exportSceneManagement() {
        if (!this._currentSceneManagement) {
            alert('先に抽出を実行してください');
            return;
        }
        this.downloadFile(this._currentSceneManagement, `シーン管理_${Date.now()}.txt`, 'text/plain');
    },

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    showStatus(message) {
        const status = document.getElementById('statusMessage');
        if (status) {
            status.textContent = message;
            setTimeout(() => {
                status.textContent = '';
            }, 3000);
        }
    },

    showHelp() {
        document.getElementById('helpDialog').style.display = 'flex';
    },

    hideHelp() {
        document.getElementById('helpDialog').style.display = 'none';
    }
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
