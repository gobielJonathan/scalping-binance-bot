// Analytics Dashboard JavaScript
class AnalyticsDashboard {
    constructor() {
        this.charts = {};
        this.currentSection = 'overview';
        this.currentFilters = {
            mode: 'paper',
            timeRange: '30d',
            symbols: [],
            startDate: null,
            endDate: null
        };
        this.currentPage = 1;
        this.pageSize = 50;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupNavigation();
        await this.loadInitialData();
        this.updateLastUpdated();
    }

    setupEventListeners() {
        // Sidebar toggle
        document.getElementById('toggleSidebar')?.addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Time range selector
        document.getElementById('timeRange')?.addEventListener('change', (e) => {
            const customRange = document.getElementById('customDateRange');
            if (e.target.value === 'custom') {
                customRange.style.display = 'flex';
            } else {
                customRange.style.display = 'none';
            }
        });

        // Report form
        document.getElementById('reportForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.generateReport();
        });

        // Page size change
        document.getElementById('tradePageSize')?.addEventListener('change', (e) => {
            this.pageSize = parseInt(e.target.value);
            this.currentPage = 1;
            this.loadTrades();
        });
    }

    setupNavigation() {
        const navLinks = document.querySelectorAll('.sidebar-nav .nav-link[data-section]');
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.closest('[data-section]').dataset.section;
                this.showSection(section);
                
                // Update active link
                navLinks.forEach(l => l.classList.remove('active'));
                e.target.closest('.nav-link').classList.add('active');
            });
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
    }

    showSection(sectionName) {
        // Hide all sections
        const sections = document.querySelectorAll('.section');
        sections.forEach(section => section.style.display = 'none');
        
        // Show selected section
        const targetSection = document.getElementById(`section-${sectionName}`);
        if (targetSection) {
            targetSection.style.display = 'block';
            this.currentSection = sectionName;
            
            // Load section-specific data
            this.loadSectionData(sectionName);
        }
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadOverviewData(),
                this.loadSymbolOptions()
            ]);
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError('Failed to load initial data');
        }
    }

    async loadSectionData(section) {
        switch (section) {
            case 'overview':
                await this.loadOverviewData();
                break;
            case 'performance':
                await this.loadPerformanceData();
                break;
            case 'risk':
                await this.loadRiskData();
                break;
            case 'trades':
                await this.loadTrades();
                break;
        }
    }

    async loadOverviewData() {
        try {
            const [summary, stats] = await Promise.all([
                this.fetchAPI('/api/analytics/summary', this.buildQueryParams()),
                this.fetchAPI('/api/analytics/stats', { mode: this.currentFilters.mode })
            ]);

            this.updateKeyMetrics(stats.total);
            this.updateInsights(summary.insights);
            this.updateMetrics(summary.summary);
            
            await this.createPnLChart();
            await this.createWinLossChart();
            
        } catch (error) {
            console.error('Error loading overview data:', error);
            this.showError('Failed to load overview data');
        }
    }

    async loadPerformanceData() {
        try {
            const [symbolPerf, timeOfDayPerf, dayOfWeekPerf] = await Promise.all([
                this.fetchAPI('/api/analytics/performance/symbol', this.buildQueryParams()),
                this.fetchAPI('/api/analytics/performance/time-of-day', this.buildQueryParams()),
                this.fetchAPI('/api/analytics/performance/day-of-week', this.buildQueryParams())
            ]);

            this.updateSymbolPerformanceTable(symbolPerf);
            await this.createSymbolPerformanceChart(symbolPerf);
            await this.createTimeOfDayChart(timeOfDayPerf);
            await this.createDayOfWeekChart(dayOfWeekPerf);
            
        } catch (error) {
            console.error('Error loading performance data:', error);
            this.showError('Failed to load performance data');
        }
    }

    async loadRiskData() {
        try {
            const [drawdown, streaks, risk] = await Promise.all([
                this.fetchAPI('/api/analytics/drawdown', this.buildQueryParams()),
                this.fetchAPI('/api/analytics/streaks', this.buildQueryParams()),
                this.fetchAPI('/api/analytics/risk', this.buildQueryParams())
            ]);

            this.updateRiskMetrics(risk);
            this.updateStreakAnalysis(streaks);
            await this.createDrawdownChart(drawdown);
            await this.createRiskDistributionChart(risk);
            
        } catch (error) {
            console.error('Error loading risk data:', error);
            this.showError('Failed to load risk data');
        }
    }

    async loadTrades() {
        try {
            const params = {
                ...this.buildQueryParams(),
                limit: this.pageSize,
                offset: (this.currentPage - 1) * this.pageSize,
                sortBy: 'openTime',
                sortOrder: 'DESC'
            };

            const response = await this.fetchAPI('/api/analytics/trades', params);
            
            this.updateTradesTable(response.trades);
            this.updatePagination(response.pagination);
            
        } catch (error) {
            console.error('Error loading trades:', error);
            this.showError('Failed to load trades');
        }
    }

    async loadSymbolOptions() {
        try {
            const stats = await this.fetchAPI('/api/analytics/stats', { mode: this.currentFilters.mode });
            const select = document.getElementById('symbolFilter');
            
            if (select && stats.symbols) {
                select.innerHTML = '<option value="">All Symbols</option>';
                stats.symbols.forEach(symbol => {
                    const option = document.createElement('option');
                    option.value = symbol;
                    option.textContent = symbol;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading symbol options:', error);
        }
    }

    // Chart creation methods
    async createPnLChart() {
        const ctx = document.getElementById('pnlChart');
        if (!ctx) return;

        try {
            const data = await this.fetchAPI('/api/analytics/trades', {
                ...this.buildQueryParams(),
                limit: 1000,
                sortBy: 'closeTime',
                sortOrder: 'ASC'
            });

            // Calculate cumulative P&L
            let cumulativePnl = 0;
            const chartData = data.trades
                .filter(trade => trade.closeTime && trade.pnl !== null)
                .map(trade => {
                    cumulativePnl += trade.pnl || 0;
                    return {
                        x: new Date(trade.closeTime),
                        y: cumulativePnl
                    };
                });

            if (this.charts.pnlChart) {
                this.charts.pnlChart.destroy();
            }

            this.charts.pnlChart = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'Cumulative P&L',
                        data: chartData,
                        borderColor: chartData[chartData.length - 1]?.y >= 0 ? '#16a34a' : '#dc2626',
                        backgroundColor: chartData[chartData.length - 1]?.y >= 0 ? 
                            'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'day'
                            }
                        },
                        y: {
                            beginAtZero: false,
                            title: {
                                display: true,
                                text: 'P&L ($)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => `P&L: $${context.parsed.y.toFixed(2)}`
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating P&L chart:', error);
        }
    }

    async createWinLossChart() {
        const ctx = document.getElementById('winLossChart');
        if (!ctx) return;

        try {
            const stats = await this.fetchAPI('/api/analytics/stats', { mode: this.currentFilters.mode });
            
            if (this.charts.winLossChart) {
                this.charts.winLossChart.destroy();
            }

            this.charts.winLossChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Wins', 'Losses'],
                    datasets: [{
                        data: [
                            stats.total.winningTrades || 0,
                            stats.total.losingTrades || 0
                        ],
                        backgroundColor: ['#16a34a', '#dc2626'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating win/loss chart:', error);
        }
    }

    async createSymbolPerformanceChart(data) {
        const ctx = document.getElementById('symbolPerformanceChart');
        if (!ctx) return;

        try {
            const sortedData = data.sort((a, b) => b.totalReturn - a.totalReturn);
            const top10 = sortedData.slice(0, 10);

            if (this.charts.symbolPerformanceChart) {
                this.charts.symbolPerformanceChart.destroy();
            }

            this.charts.symbolPerformanceChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: top10.map(item => item.symbol),
                    datasets: [{
                        label: 'Total Return (%)',
                        data: top10.map(item => item.totalReturn),
                        backgroundColor: top10.map(item => item.totalReturn >= 0 ? '#16a34a' : '#dc2626')
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            title: {
                                display: true,
                                text: 'Total Return (%)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating symbol performance chart:', error);
        }
    }

    async createTimeOfDayChart(data) {
        const ctx = document.getElementById('timeOfDayChart');
        if (!ctx) return;

        try {
            if (this.charts.timeOfDayChart) {
                this.charts.timeOfDayChart.destroy();
            }

            this.charts.timeOfDayChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.map(item => `${item.hour}:00`),
                    datasets: [{
                        label: 'Avg Return (%)',
                        data: data.map(item => item.avgReturn),
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            title: {
                                display: true,
                                text: 'Average Return (%)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating time of day chart:', error);
        }
    }

    async createDayOfWeekChart(data) {
        const ctx = document.getElementById('dayOfWeekChart');
        if (!ctx) return;

        try {
            if (this.charts.dayOfWeekChart) {
                this.charts.dayOfWeekChart.destroy();
            }

            this.charts.dayOfWeekChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.map(item => item.dayName),
                    datasets: [{
                        label: 'Total P&L',
                        data: data.map(item => item.totalPnl),
                        backgroundColor: data.map(item => item.totalPnl >= 0 ? '#16a34a' : '#dc2626')
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            title: {
                                display: true,
                                text: 'Total P&L ($)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating day of week chart:', error);
        }
    }

    async createDrawdownChart(drawdownData) {
        const ctx = document.getElementById('drawdownChart');
        if (!ctx) return;

        try {
            // Create drawdown visualization data
            const chartData = drawdownData.drawdownPeriods.map((period, index) => ({
                x: new Date(period.startDate),
                y: -period.maxDrawdown
            }));

            if (this.charts.drawdownChart) {
                this.charts.drawdownChart.destroy();
            }

            this.charts.drawdownChart = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'Drawdown',
                        data: chartData,
                        borderColor: '#dc2626',
                        backgroundColor: 'rgba(220, 38, 38, 0.1)',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'day'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Drawdown ($)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating drawdown chart:', error);
        }
    }

    async createRiskDistributionChart(riskData) {
        const ctx = document.getElementById('riskDistributionChart');
        if (!ctx) return;

        try {
            if (this.charts.riskDistributionChart) {
                this.charts.riskDistributionChart.destroy();
            }

            this.charts.riskDistributionChart = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ['VaR', 'Volatility', 'Risk-Adj Return', 'Max Risk', 'Expected Shortfall'],
                    datasets: [{
                        label: 'Risk Profile',
                        data: [
                            Math.abs(riskData.valueAtRisk),
                            riskData.volatility * 100,
                            riskData.riskAdjustedReturn,
                            Math.abs(riskData.maximumRisk),
                            Math.abs(riskData.expectedShortfall)
                        ],
                        backgroundColor: 'rgba(220, 38, 38, 0.2)',
                        borderColor: '#dc2626',
                        pointBackgroundColor: '#dc2626'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        r: {
                            beginAtZero: true
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating risk distribution chart:', error);
        }
    }

    // Update UI methods
    updateKeyMetrics(stats) {
        this.updateElement('statTotalTrades', stats.trades?.toString() || '0');
        this.updateElement('statWinRate', `${stats.winRate?.toFixed(1) || '0.0'}%`);
        this.updateElement('statTotalPnl', `$${stats.totalPnl?.toFixed(2) || '0.00'}`);
        this.updateElement('statMaxDrawdown', `$${stats.maxDrawdown?.toFixed(2) || '0.00'}`);
    }

    updateInsights(insights) {
        const container = document.getElementById('insightsContainer');
        if (!container) return;

        if (!insights || insights.length === 0) {
            container.innerHTML = '<div class="text-muted text-center">No insights available</div>';
            return;
        }

        container.innerHTML = insights.map(insight => `
            <div class="insight-card">
                <div class="content">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-lightbulb me-2"></i>
                        <span>${insight}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateMetrics(summary) {
        const container = document.getElementById('metricsContainer');
        if (!container) return;

        const metrics = [
            { label: 'Profit Factor', value: summary.profitFactor?.toFixed(2) || '0.00' },
            { label: 'Sharpe Ratio', value: summary.sharpeRatio?.toFixed(2) || '0.00' },
            { label: 'Avg Win', value: `$${summary.avgWin?.toFixed(2) || '0.00'}` },
            { label: 'Avg Loss', value: `$${summary.avgLoss?.toFixed(2) || '0.00'}` },
            { label: 'Best Trade', value: `$${summary.maxWin?.toFixed(2) || '0.00'}` },
            { label: 'Worst Trade', value: `$${summary.maxLoss?.toFixed(2) || '0.00'}` },
            { label: 'Total Fees', value: `$${summary.totalFees?.toFixed(2) || '0.00'}` },
            { label: 'Expectancy', value: `$${summary.expectancy?.toFixed(2) || '0.00'}` }
        ];

        container.innerHTML = metrics.map(metric => `
            <div class="metric-item">
                <span class="text-muted">${metric.label}</span>
                <strong>${metric.value}</strong>
            </div>
        `).join('');
    }

    updateSymbolPerformanceTable(data) {
        const tbody = document.querySelector('#symbolPerformanceTable tbody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No data available</td></tr>';
            return;
        }

        const sortedData = data.sort((a, b) => b.totalReturn - a.totalReturn);
        
        tbody.innerHTML = sortedData.map(item => {
            const rating = this.calculatePerformanceRating(item.winRate, item.totalReturn);
            return `
                <tr>
                    <td><strong>${item.symbol}</strong></td>
                    <td>${item.totalTrades}</td>
                    <td>${item.winRate.toFixed(1)}%</td>
                    <td class="${item.avgReturn >= 0 ? 'text-success' : 'text-danger'}">
                        ${item.avgReturn.toFixed(2)}%
                    </td>
                    <td class="${item.totalPnl >= 0 ? 'text-success' : 'text-danger'}">
                        $${item.totalPnl.toFixed(2)}
                    </td>
                    <td>
                        <span class="performance-badge ${rating.class}">${rating.text}</span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    updateRiskMetrics(risk) {
        const container = document.getElementById('riskMetricsContainer');
        if (!container) return;

        const metrics = [
            { label: 'Value at Risk (95%)', value: `$${Math.abs(risk.valueAtRisk || 0).toFixed(2)}` },
            { label: 'Expected Shortfall', value: `$${Math.abs(risk.expectedShortfall || 0).toFixed(2)}` },
            { label: 'Volatility', value: `${(risk.volatility * 100 || 0).toFixed(2)}%` },
            { label: 'Risk-Adjusted Return', value: risk.riskAdjustedReturn?.toFixed(3) || '0.000' }
        ];

        container.innerHTML = `
            <div class="metric-list">
                ${metrics.map(metric => `
                    <div class="metric-item">
                        <span class="text-muted small">${metric.label}</span>
                        <strong>${metric.value}</strong>
                    </div>
                `).join('')}
            </div>
        `;
    }

    updateStreakAnalysis(streaks) {
        const container = document.getElementById('streakAnalysisContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="row">
                <div class="col-6">
                    <div class="text-center p-3 bg-success bg-opacity-10 rounded">
                        <div class="h4 text-success">${streaks.longestWinStreak}</div>
                        <div class="small text-muted">Longest Win Streak</div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="text-center p-3 bg-danger bg-opacity-10 rounded">
                        <div class="h4 text-danger">${streaks.longestLossStreak}</div>
                        <div class="small text-muted">Longest Loss Streak</div>
                    </div>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-6">
                    <div class="text-center">
                        <div class="h6 text-success">${streaks.currentWinStreak}</div>
                        <div class="small text-muted">Current Win Streak</div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="text-center">
                        <div class="h6 text-danger">${streaks.currentLossStreak}</div>
                        <div class="small text-muted">Current Loss Streak</div>
                    </div>
                </div>
            </div>
        `;
    }

    updateTradesTable(trades) {
        const tbody = document.querySelector('#tradesTable tbody');
        if (!tbody) return;

        if (!trades || trades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">No trades found</td></tr>';
            return;
        }

        tbody.innerHTML = trades.map(trade => `
            <tr>
                <td>${this.formatDateTime(trade.openTime)}</td>
                <td><strong>${trade.symbol}</strong></td>
                <td>
                    <span class="badge ${trade.side === 'BUY' ? 'bg-success' : 'bg-danger'}">
                        ${trade.side}
                    </span>
                </td>
                <td>${trade.quantity}</td>
                <td>$${trade.entryPrice}</td>
                <td>${trade.exitPrice ? `$${trade.exitPrice}` : '-'}</td>
                <td class="${(trade.pnl || 0) >= 0 ? 'text-success' : 'text-danger'}">
                    ${trade.pnl ? `$${trade.pnl.toFixed(2)}` : '-'}
                </td>
                <td class="${(trade.pnlPercent || 0) >= 0 ? 'text-success' : 'text-danger'}">
                    ${trade.pnlPercent ? `${trade.pnlPercent.toFixed(2)}%` : '-'}
                </td>
                <td>${trade.durationHours ? `${trade.durationHours.toFixed(1)}h` : '-'}</td>
                <td>
                    <span class="performance-badge ${this.getOutcomeClass(trade.outcome)}">
                        ${trade.outcome || 'OPEN'}
                    </span>
                </td>
            </tr>
        `).join('');
    }

    updatePagination(pagination) {
        const container = document.getElementById('tradePagination');
        if (!container) return;

        const totalPages = pagination.pages;
        const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
        
        let paginationHTML = '';

        // Previous button
        paginationHTML += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="analytics.changePage(${currentPage - 1})">Previous</a>
            </li>
        `;

        // Page numbers
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="analytics.changePage(${i})">${i}</a>
                </li>
            `;
        }

        // Next button
        paginationHTML += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="analytics.changePage(${currentPage + 1})">Next</a>
            </li>
        `;

        container.innerHTML = paginationHTML;
    }

    // Utility methods
    buildQueryParams() {
        const params = { mode: this.currentFilters.mode };
        
        if (this.currentFilters.startDate) {
            params.startDate = this.currentFilters.startDate;
        }
        
        if (this.currentFilters.endDate) {
            params.endDate = this.currentFilters.endDate;
        } else if (this.currentFilters.timeRange !== 'all' && this.currentFilters.timeRange !== 'custom') {
            const now = new Date();
            const days = parseInt(this.currentFilters.timeRange.replace('d', ''));
            params.startDate = now.getTime() - (days * 24 * 60 * 60 * 1000);
        }
        
        if (this.currentFilters.symbols.length > 0) {
            params.symbols = this.currentFilters.symbols.join(',');
        }
        
        return params;
    }

    async fetchAPI(endpoint, params = {}) {
        const url = new URL(endpoint, window.location.origin);
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                url.searchParams.append(key, params[key]);
            }
        });

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }
        
        return response.json();
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    formatDateTime(timestamp) {
        return new Date(timestamp).toLocaleString();
    }

    calculatePerformanceRating(winRate, totalReturn) {
        if (winRate >= 70 && totalReturn >= 10) {
            return { class: 'excellent', text: 'Excellent' };
        } else if (winRate >= 60 && totalReturn >= 5) {
            return { class: 'good', text: 'Good' };
        } else if (winRate >= 50 && totalReturn >= 0) {
            return { class: 'average', text: 'Average' };
        } else {
            return { class: 'poor', text: 'Poor' };
        }
    }

    getOutcomeClass(outcome) {
        switch (outcome) {
            case 'WIN': return 'excellent';
            case 'LOSS': return 'poor';
            case 'BREAKEVEN': return 'average';
            default: return 'average';
        }
    }

    updateLastUpdated() {
        const element = document.getElementById('lastUpdated');
        if (element) {
            element.textContent = new Date().toLocaleTimeString();
        }
    }

    showError(message) {
        // Create a toast or alert for errors
        console.error(message);
        // You could implement a proper toast notification here
    }

    // Event handlers
    changePage(page) {
        this.currentPage = page;
        this.loadTrades();
    }

    async applyFilters() {
        // Get filter values
        this.currentFilters.mode = document.getElementById('tradingMode').value;
        this.currentFilters.timeRange = document.getElementById('timeRange').value;
        
        const symbolSelect = document.getElementById('symbolFilter');
        this.currentFilters.symbols = Array.from(symbolSelect.selectedOptions).map(option => option.value).filter(v => v);
        
        if (this.currentFilters.timeRange === 'custom') {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            
            if (startDate) {
                this.currentFilters.startDate = new Date(startDate).getTime();
            }
            if (endDate) {
                this.currentFilters.endDate = new Date(endDate).getTime();
            }
        } else {
            this.currentFilters.startDate = null;
            this.currentFilters.endDate = null;
        }

        // Reload current section data
        await this.loadSectionData(this.currentSection);
        this.updateLastUpdated();
    }

    async refreshData() {
        await this.loadSectionData(this.currentSection);
        this.updateLastUpdated();
    }

    async refreshInsights() {
        try {
            const summary = await this.fetchAPI('/api/analytics/summary', this.buildQueryParams());
            this.updateInsights(summary.insights);
        } catch (error) {
            console.error('Error refreshing insights:', error);
        }
    }

    async generateReport() {
        const format = document.getElementById('reportFormat').value;
        const groupBy = document.getElementById('reportGroupBy').value;
        const includeCharts = document.getElementById('includeCharts').checked;

        try {
            const response = await fetch('/api/analytics/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    format,
                    groupBy,
                    includeCharts,
                    dateRange: {
                        start: this.currentFilters.startDate,
                        end: this.currentFilters.endDate
                    },
                    symbols: this.currentFilters.symbols
                })
            });

            const result = await response.json();
            
            if (result.success) {
                alert(`Report generated successfully: ${result.filePath}`);
            } else {
                throw new Error(result.message || 'Failed to generate report');
            }
        } catch (error) {
            console.error('Error generating report:', error);
            alert('Failed to generate report');
        }
    }

    async clearCache() {
        try {
            const response = await fetch('/api/analytics/cache', { method: 'DELETE' });
            const result = await response.json();
            
            if (result.success) {
                alert('Cache cleared successfully');
                await this.refreshData();
            }
        } catch (error) {
            console.error('Error clearing cache:', error);
            alert('Failed to clear cache');
        }
    }

    async refreshAllData() {
        try {
            await this.clearCache();
            await this.loadInitialData();
            await this.loadSectionData(this.currentSection);
        } catch (error) {
            console.error('Error refreshing all data:', error);
        }
    }

    exportCurrentView() {
        // This could be implemented to export the current view as an image or PDF
        alert('Export current view functionality coming soon');
    }

    toggleChartType(chartId, type) {
        // This could be implemented to switch between different chart types
        console.log(`Toggle chart ${chartId} to ${type}`);
    }
}

// Global functions for HTML onclick handlers
let analytics;

async function refreshData() {
    await analytics.refreshData();
}

async function exportReport() {
    await analytics.generateReport();
}

async function applyFilters() {
    await analytics.applyFilters();
}

async function loadTrades() {
    await analytics.loadTrades();
}

async function refreshInsights() {
    await analytics.refreshInsights();
}

async function clearCache() {
    await analytics.clearCache();
}

async function refreshAllData() {
    await analytics.refreshAllData();
}

function exportCurrentView() {
    analytics.exportCurrentView();
}

function toggleChartType(chartId, type) {
    analytics.toggleChartType(chartId, type);
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    analytics = new AnalyticsDashboard();
});