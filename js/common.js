// 公共辅助函数
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// 分页组件（圆角样式）
function renderPaginationWithDots(containerId, currentPage, totalPages, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    let pages = [];
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
        pages.push(1);
        if (currentPage > 3) pages.push('...');
        let start = Math.max(2, currentPage - 1);
        let end = Math.min(totalPages - 1, currentPage + 1);
        if (currentPage <= 3) { start = 2; end = 4; }
        if (currentPage >= totalPages - 2) { start = totalPages - 3; end = totalPages - 1; }
        for (let i = start; i <= end; i++) pages.push(i);
        if (currentPage < totalPages - 2) pages.push('...');
        pages.push(totalPages);
    }
    let html = `<button class="prev-page" ${currentPage===1?'disabled':''}>‹ 上一页</button>`;
    for (let p of pages) {
        if (p === '...') {
            html += `<span class="page-dots" data-dots="true">...</span>`;
        } else {
            html += `<span class="page-number ${p===currentPage?'active':''}" data-page="${p}">${p}</span>`;
        }
    }
    html += `<button class="next-page" ${currentPage===totalPages?'disabled':''}>下一页 ›</button>`;
    container.innerHTML = html;

    container.querySelectorAll('.page-number').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (!isNaN(page) && page !== currentPage) onPageChange(page);
        });
    });
    const prevBtn = container.querySelector('.prev-page');
    const nextBtn = container.querySelector('.next-page');
    if (prevBtn) prevBtn.addEventListener('click', () => { if (currentPage > 1) onPageChange(currentPage - 1); });
    if (nextBtn) nextBtn.addEventListener('click', () => { if (currentPage < totalPages) onPageChange(currentPage + 1); });
    container.querySelectorAll('.page-dots').forEach(dots => {
        dots.addEventListener('click', () => {
            let input = prompt(`您要跳转到哪一页？（1-${totalPages}）`, currentPage);
            if (input !== null) {
                let page = parseInt(input);
                if (!isNaN(page) && page >= 1 && page <= totalPages) onPageChange(page);
                else alert(`请输入 1-${totalPages} 之间的数字`);
            }
        });
    });
}

// 简单表格渲染
function renderSimpleTable(containerId, data, columns, pageSize = 10) {
    let currentPage = 1;
    let filteredData = [...data];

    function render() {
        const start = (currentPage - 1) * pageSize;
        const pageData = filteredData.slice(start, start + pageSize);
        const tbody = document.querySelector(`#${containerId} tbody`);
        if (!tbody) return;
        if (pageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="999" class="empty-tip">没有匹配的内容</td></tr>';
        } else {
            tbody.innerHTML = pageData.map(row => {
                let cells = '';
                columns.forEach(col => {
                    let value = row[col.key] || '-';
                    if (col.type === 'video' && value && value !== '') {
                        let platform = row.platform || 'bilibili';
                        let icon = '';
                        if (platform === 'bilibili') icon = '🎬 B站';
                        else if (platform === 'douyin') icon = '🎵 抖音';
                        else if (platform === 'kuaishou') icon = '📱 快手';
                        else icon = '🎬 视频';
                        value = `<a href="${value}" target="_blank" style="color:#3B82F6;">${icon}</a>`;
                    } else if (col.type === 'url' && value && value !== '') {
                        value = `<a href="${value}" target="_blank" style="color:#3B82F6;">🔗 详情</a>`;
                    }
                    cells += `<td>${value}</td>`;
                });
                return `<tr>${cells}</tr>`;
            }).join('');
        }
        const totalPages = Math.ceil(filteredData.length / pageSize);
        renderPaginationWithDots(`${containerId}-pagination`, currentPage, totalPages, (newPage) => {
            currentPage = newPage;
            render();
        });
    }

    function filterData(query) {
        if (!query) filteredData = [...data];
        else filteredData = data.filter(row => {
            return columns.some(col => {
                let val = row[col.key];
                return val && val.toString().toLowerCase().includes(query.toLowerCase());
            });
        });
        currentPage = 1;
        render();
    }

    const container = document.getElementById(containerId);
    if (container && !container.querySelector('.simple-search')) {
        const searchHtml = `<div class="simple-search" style="margin-bottom:12px;"><input type="text" placeholder="搜索..." id="${containerId}-search" style="width:100%; padding:6px 12px; border:1px solid var(--border-color); border-radius:30px;"></div>`;
        container.insertAdjacentHTML('afterbegin', searchHtml);
        const searchBox = document.getElementById(`${containerId}-search`);
        if (searchBox) searchBox.addEventListener('input', (e) => filterData(e.target.value));
    }
    render();
}

// 全局折叠组函数
window.toggleGroup = function(header) {
    const options = header.nextElementSibling;
    const arrow = header.querySelector('.group-arrow');
    if (options.classList.contains('collapsed')) {
        options.classList.remove('collapsed');
        arrow.textContent = '▼';
    } else {
        options.classList.add('collapsed');
        arrow.textContent = '▶';
    }
};

// ---------- 僵毁模组统计组件（完整版）----------
class ModStatsView {
    constructor(containerId, modsData) {
        this.containerId = containerId;
        this.allMods = modsData;
        this.filteredMods = [...modsData];
        this.currentPage = 1;
        this.pageSize = 15;
        this.searchQuery = '';
        this.gameQuery = '';
        this.statusFilter = '全部';
        this.offlineFilter = 'all';
        this.noteFilter = 'all';
        this.chineseFilter = 'all';
        this.videoFilter = 'all';
        this.filterCollapsed = false;
        this.init();
    }

    init() { this.render(); }

    getStatusClass(status) {
        const map = { '完整':'status-complete', '非完整':'status-incomplete', '待检测':'status-pending', '无需翻译':'status-unneeded', '待处理':'status-todo' };
        return map[status] || '';
    }

    getModLink(mod) {
        if (mod.platform === 'steam' && mod.steamId) return `https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.steamId}`;
        if (mod.platform === 'mcmod' && mod.mcmodId) return `https://www.mcmod.cn/class/${mod.mcmodId}.html`;
        return '#';
    }

    getVideoUrl(mod, platform) {
        if (mod.videos) {
            if (platform === 'bilibili') return mod.videos.bilibili || '';
            if (platform === 'douyin') return mod.videos.douyin || '';
            if (platform === 'kuaishou') return mod.videos.kuaishou || '';
        }
        if (platform === 'bilibili' && mod.videoUrl && mod.videoUrl !== '视频待发布') return mod.videoUrl;
        return '';
    }

    updateStats() {
        const statsDiv = document.getElementById(`${this.containerId}-stats`);
        if (!statsDiv) return;
        const total = this.allMods.length;
        const countComplete = this.allMods.filter(m => m.status === '完整').length;
        const countIncomplete = this.allMods.filter(m => m.status === '非完整').length;
        const countPending = this.allMods.filter(m => m.status === '待检测').length;
        const countUnneeded = this.allMods.filter(m => m.status === '无需翻译').length;
        const countTodo = this.allMods.filter(m => m.status === '待处理').length;
        const countHasVideo = this.allMods.filter(m => this.getVideoUrl(m, 'bilibili') !== '' || this.getVideoUrl(m, 'douyin') !== '' || this.getVideoUrl(m, 'kuaishou') !== '').length;
        const countNoVideo = total - countHasVideo;
        statsDiv.innerHTML = `
            <div class="stats-item"><span class="icon">📊</span> 总模组: <span class="stats-number">${total}</span></div>
            <div class="stats-item stats-complete"><span class="icon">✅</span> 完整: <span class="stats-number">${countComplete}</span></div>
            <div class="stats-item stats-todo"><span class="icon">⏳</span> 待处理: <span class="stats-number">${countTodo}</span></div>
            <div class="stats-item stats-pending"><span class="icon">🔍</span> 待检测: <span class="stats-number">${countPending}</span></div>
            <div class="stats-item stats-incomplete"><span class="icon">🟡</span> 非完整: <span class="stats-number">${countIncomplete}</span></div>
            <div class="stats-item stats-unneeded"><span class="icon">🟣</span> 无需翻译: <span class="stats-number">${countUnneeded}</span></div>
            <div class="stats-item"><span class="icon">📹</span> 已拥有视频: <span class="stats-number">${countHasVideo}</span></div>
            <div class="stats-item"><span class="icon">🚫</span> 未拥有视频: <span class="stats-number">${countNoVideo}</span></div>
        `;
    }

    applyFilters() {
        let filtered = [...this.allMods];
        if (this.searchQuery.trim()) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(mod => mod.name.toLowerCase().includes(q) || (mod.steamId && mod.steamId.includes(q)) || (mod.mcmodId && mod.mcmodId.includes(q)) || (mod.chineseName && mod.chineseName.toLowerCase().includes(q)) || (mod.note && mod.note.toLowerCase().includes(q)));
        }
        if (this.gameQuery) {
            filtered = filtered.filter(mod => mod.game && mod.game.toLowerCase().includes(this.gameQuery));
        }
        if (this.statusFilter !== '全部') filtered = filtered.filter(mod => mod.status === this.statusFilter);
        if (this.offlineFilter !== 'all') filtered = filtered.filter(mod => mod.offline === (this.offlineFilter === 'yes'));
        if (this.noteFilter !== 'all') filtered = filtered.filter(mod => this.noteFilter === 'yes' ? (mod.note && mod.note.trim()) : (!mod.note || !mod.note.trim()));
        if (this.chineseFilter !== 'all') filtered = filtered.filter(mod => this.chineseFilter === 'yes' ? (mod.chineseName && mod.chineseName.trim()) : (!mod.chineseName || !mod.chineseName.trim()));
        if (this.videoFilter !== 'all') filtered = filtered.filter(mod => this.videoFilter === 'yes' ? (this.getVideoUrl(mod, 'bilibili') !== '' || this.getVideoUrl(mod, 'douyin') !== '' || this.getVideoUrl(mod, 'kuaishou') !== '') : (this.getVideoUrl(mod, 'bilibili') === '' && this.getVideoUrl(mod, 'douyin') === '' && this.getVideoUrl(mod, 'kuaishou') === ''));
        this.filteredMods = filtered;
        this.currentPage = 1;
        this.renderTable();
        this.renderPagination();
    }

    renderTable() {
        const tbody = document.getElementById(`${this.containerId}-tbody`);
        if (!tbody) return;
        const start = (this.currentPage - 1) * this.pageSize;
        const pageMods = this.filteredMods.slice(start, start + this.pageSize);
        if (pageMods.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px;">没有匹配的模组</td></tr>';
            return;
        }
        let html = '';
        pageMods.forEach(mod => {
            const biliUrl = this.getVideoUrl(mod, 'bilibili');
            const douyinUrl = this.getVideoUrl(mod, 'douyin');
            const kuaishouUrl = this.getVideoUrl(mod, 'kuaishou');
            let videoHtml = '';
            if (biliUrl) videoHtml += `<a href="${biliUrl}" target="_blank" style="color:#3B82F6; margin-right: 8px;">🎬 B站</a>`;
            if (douyinUrl) videoHtml += `<a href="${douyinUrl}" target="_blank" style="color:#3B82F6; margin-right: 8px;">🎵 抖音</a>`;
            if (kuaishouUrl) videoHtml += `<a href="${kuaishouUrl}" target="_blank" style="color:#3B82F6;">📱 快手</a>`;
            if (!videoHtml) videoHtml = '-';
            const statusClass = this.getStatusClass(mod.status);
            const chineseName = mod.chineseName || '-';
            const modLink = this.getModLink(mod);
            let idDisplay = '';
            if (mod.steamId) idDisplay = `<span class="mod-id">${mod.steamId}</span>`;
            else if (mod.mcmodId) idDisplay = `<span class="mod-id">MC百科 ID: ${mod.mcmodId}</span>`;
            else if (mod.id) idDisplay = `<span class="mod-id">${mod.id}</span>`;
            html += `<tr>
                <td><a href="${modLink}" target="_blank">${escapeHtml(mod.name)}</a>${idDisplay}</td>
                <td>${escapeHtml(chineseName)}</td>
                <td><span class="status-badge ${statusClass}">${mod.status}</span></td>
                <td>${videoHtml}</td>
                <td>${escapeHtml(mod.note || '-')}</td>
            </tr>`;
        });
        tbody.innerHTML = html;
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredMods.length / this.pageSize);
        renderPaginationWithDots(`${this.containerId}-pagination`, this.currentPage, totalPages, (newPage) => {
            this.currentPage = newPage;
            this.renderTable();
            this.renderPagination();
        });
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        let html = `
            <div id="${this.containerId}-stats" class="stats-bar">加载统计中...</div>
            <div class="search-box"><input type="text" id="${this.containerId}-search" placeholder="搜索模组名称、中文名、ID或备注..."></div>
            <div class="filter-section">
                <div class="filter-header" id="${this.containerId}-filterToggle"><span><span>🔍</span> 高级筛选</span><span class="arrow">▼</span></div>
                <div class="filter-content" id="${this.containerId}-filterContent">
                    <div class="filter-group"><div class="filter-group-header" onclick="window.toggleGroup(this)"><span class="group-arrow">▶</span><span>游戏</span></div><div class="filter-group-options collapsed"><input type="text" id="${this.containerId}-gameSearch" class="game-search-input" placeholder="输入游戏名称..."></div></div>
                    <div class="filter-group"><div class="filter-group-header" onclick="window.toggleGroup(this)"><span class="group-arrow">▶</span><span>翻译状态</span></div><div class="filter-group-options collapsed" id="${this.containerId}-statusFilterGroup"></div></div>
                    <div class="filter-group"><div class="filter-group-header" onclick="window.toggleGroup(this)"><span class="group-arrow">▶</span><span>离线分享</span></div><div class="filter-group-options collapsed" id="${this.containerId}-offlineFilterGroup"><span class="filter-btn active" data-group="offline" data-value="all">全部</span><span class="filter-btn" data-group="offline" data-value="yes">已上传</span><span class="filter-btn" data-group="offline" data-value="no">未上传</span></div></div>
                    <div class="filter-group"><div class="filter-group-header" onclick="window.toggleGroup(this)"><span class="group-arrow">▶</span><span>备注</span></div><div class="filter-group-options collapsed" id="${this.containerId}-noteFilterGroup"><span class="filter-btn active" data-group="note" data-value="all">全部</span><span class="filter-btn" data-group="note" data-value="yes">有备注</span><span class="filter-btn" data-group="note" data-value="no">无备注</span></div></div>
                    <div class="filter-group"><div class="filter-group-header" onclick="window.toggleGroup(this)"><span class="group-arrow">▶</span><span>中文名</span></div><div class="filter-group-options collapsed" id="${this.containerId}-chineseFilterGroup"><span class="filter-btn active" data-group="chinese" data-value="all">全部</span><span class="filter-btn" data-group="chinese" data-value="yes">有中文名</span><span class="filter-btn" data-group="chinese" data-value="no">无中文名</span></div></div>
                    <div class="filter-group"><div class="filter-group-header" onclick="window.toggleGroup(this)"><span class="group-arrow">▶</span><span>视频教程</span></div><div class="filter-group-options collapsed" id="${this.containerId}-videoFilterGroup"><span class="filter-btn active" data-group="video" data-value="all">全部</span><span class="filter-btn" data-group="video" data-value="yes">有教程</span><span class="filter-btn" data-group="video" data-value="no">无教程</span></div></div>
                </div>
            </div>
            <div class="table-responsive"><table class="mod-table"><thead><tr><th>模组名称 / ID</th><th>模组中文名</th><th>翻译进度</th><th>视频教程</th><th>备注</th></tr></thead><tbody id="${this.containerId}-tbody"></tbody></table></div>
            <div class="pagination" id="${this.containerId}-pagination"></div>
        `;
        container.innerHTML = html;

        const filterToggle = document.getElementById(`${this.containerId}-filterToggle`);
        const filterContent = document.getElementById(`${this.containerId}-filterContent`);
        if (filterToggle) {
            filterToggle.addEventListener('click', () => {
                this.filterCollapsed = !this.filterCollapsed;
                filterContent.classList.toggle('collapsed', this.filterCollapsed);
                filterToggle.classList.toggle('collapsed', this.filterCollapsed);
            });
        }

        const statusSet = new Set();
        this.allMods.forEach(mod => { if (mod.status) statusSet.add(mod.status); });
        const statusList = ['全部', ...Array.from(statusSet).sort()];
        const statusGroup = document.getElementById(`${this.containerId}-statusFilterGroup`);
        if (statusGroup) {
            statusGroup.innerHTML = statusList.map(s => `<span class="filter-btn ${s==='全部'?'active':''}" data-group="status" data-value="${s}">${s}</span>`).join('');
            statusGroup.querySelectorAll('[data-group="status"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    statusGroup.querySelectorAll('[data-group="status"]').forEach(b=>b.classList.remove('active'));
                    btn.classList.add('active');
                    this.statusFilter = btn.dataset.value;
                    this.applyFilters();
                });
            });
        }

        const offlineGroup = document.getElementById(`${this.containerId}-offlineFilterGroup`);
        if (offlineGroup) {
            offlineGroup.querySelectorAll('[data-group="offline"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    offlineGroup.querySelectorAll('[data-group="offline"]').forEach(b=>b.classList.remove('active'));
                    btn.classList.add('active');
                    this.offlineFilter = btn.dataset.value;
                    this.applyFilters();
                });
            });
        }
        const noteGroup = document.getElementById(`${this.containerId}-noteFilterGroup`);
        if (noteGroup) {
            noteGroup.querySelectorAll('[data-group="note"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    noteGroup.querySelectorAll('[data-group="note"]').forEach(b=>b.classList.remove('active'));
                    btn.classList.add('active');
                    this.noteFilter = btn.dataset.value;
                    this.applyFilters();
                });
            });
        }
        const chineseGroup = document.getElementById(`${this.containerId}-chineseFilterGroup`);
        if (chineseGroup) {
            chineseGroup.querySelectorAll('[data-group="chinese"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    chineseGroup.querySelectorAll('[data-group="chinese"]').forEach(b=>b.classList.remove('active'));
                    btn.classList.add('active');
                    this.chineseFilter = btn.dataset.value;
                    this.applyFilters();
                });
            });
        }
        const videoGroup = document.getElementById(`${this.containerId}-videoFilterGroup`);
        if (videoGroup) {
            videoGroup.querySelectorAll('[data-group="video"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    videoGroup.querySelectorAll('[data-group="video"]').forEach(b=>b.classList.remove('active'));
                    btn.classList.add('active');
                    this.videoFilter = btn.dataset.value;
                    this.applyFilters();
                });
            });
        }

        const searchBox = document.getElementById(`${this.containerId}-search`);
        if (searchBox) {
            searchBox.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.applyFilters();
            });
        }
        const gameSearchBox = document.getElementById(`${this.containerId}-gameSearch`);
        if (gameSearchBox) {
            gameSearchBox.addEventListener('input', (e) => {
                this.gameQuery = e.target.value;
                this.applyFilters();
            });
        }

        this.updateStats();
        this.applyFilters();
    }
}

window.ModStatsView = ModStatsView;