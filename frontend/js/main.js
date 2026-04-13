// ===== ESTADO GLOBAL =====
const API = 'https://mediashelf-api.onrender.com/api'
let token = localStorage.getItem('token') || null
let currentUser = JSON.parse(localStorage.getItem('user') || 'null')
let activeCategoryId = ''
let currentSearchQuery = ''
let currentSearchPage = 1
let currentSearchType = ''
let hasMoreResults = false

// ===== ELEMENTOS DEL DOM =====
const catalogGrid = document.getElementById('catalog-grid')
const searchGrid = document.getElementById('search-grid')
const searchResults = document.getElementById('search-results')
const searchInput = document.getElementById('search-input')
const btnSearch = document.getElementById('btn-search')
const btnLogin = document.getElementById('btn-login')
const btnLogout = document.getElementById('btn-logout')
const modal = document.getElementById('modal')
const modalBody = document.getElementById('modal-body')
const modalClose = document.getElementById('modal-close')
const modalOverlay = document.getElementById('modal-overlay')
const modalLogin = document.getElementById('modal-login')
const loginClose = document.getElementById('login-close')
const loginOverlay = document.getElementById('login-overlay')
const inputUsername = document.getElementById('input-username')
const inputPassword = document.getElementById('input-password')
const btnSubmitLogin = document.getElementById('btn-submit-login')
const loginError = document.getElementById('login-error')
const emptyMessage = document.getElementById('empty-message')
const catalogTitle = document.getElementById('catalog-title')

// Elementos de Mi Lista
const btnMiLista = document.getElementById('btn-mi-lista')
const miListaSection = document.getElementById('mi-lista-section')
const miListaGrid = document.getElementById('mi-lista-grid')
const miListaEmpty = document.getElementById('mi-lista-empty')
const mainSection = document.querySelector('.main')
const heroSection = document.querySelector('.hero')
const btnVolver = document.getElementById('btn-volver')

// ===== FUNCIONES AUXILIARES =====
function escapeHtml(text) {
    if (!text) return ''
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI()
    loadCatalog()
    setupCategoryFilters()
})

// ===== AUTH UI =====
function updateAuthUI() {
    const isLoggedIn = token && currentUser;
    const btnPerfil = document.getElementById('btn-perfil');
    
    if (isLoggedIn) {
        btnLogin.classList.add('hidden')
        btnLogout.classList.remove('hidden')
        btnLogout.textContent = `Salir (${currentUser.username})`
        if (btnMiLista) btnMiLista.style.display = 'inline-block'
        if (btnPerfil) btnPerfil.style.display = 'inline-block'
    } else {
        btnLogin.classList.remove('hidden')
        btnLogout.classList.add('hidden')
        if (btnMiLista) btnMiLista.style.display = 'none'
        if (btnPerfil) btnPerfil.style.display = 'none'
        if (miListaSection) miListaSection.classList.add('hidden')
        if (mainSection) mainSection.classList.remove('hidden')
        if (heroSection) heroSection.classList.remove('hidden')
    }
}

// ===== CARGAR CATÁLOGO =====
async function loadCatalog(categoryId = '') {
    try {
        let url = `${API}/media/all`
        if (categoryId) url += `?category_id=${categoryId}`

        const res = await fetch(url)
        const data = await res.json()

        catalogGrid.innerHTML = ''

        if (data.length === 0) {
            emptyMessage.classList.remove('hidden')
            return
        }

        emptyMessage.classList.add('hidden')
        data.forEach(item => {
            catalogGrid.appendChild(createCard(item, false))
        })
    } catch (err) {
        console.error('Error cargando catálogo:', err)
    }
}

// ===== CREAR CARD PARA CATÁLOGO Y BÚSQUEDA =====
function createCard(item, isSearchResult = false) {
    const card = document.createElement('div')
    card.classList.add('card')

    const cover = item.cover_url
        ? `<img class="card__cover" src="${item.cover_url}" alt="${escapeHtml(item.title)}" loading="lazy"/>`
        : `<div class="card__cover--placeholder">🎬</div>`

    const rating = item.rating
        ? `<p class="card__rating">⭐ ${item.rating}</p>`
        : ''

    const status = item.status
        ? `<p class="card__status">${formatStatus(item.status)}</p>`
        : ''

    card.innerHTML = `
        ${cover}
        <div class="card__info">
            <p class="card__title">${escapeHtml(item.title)}</p>
            <p class="card__year">${item.year || ''}</p>
            ${rating}
            ${status}
        </div>
    `

    if (isSearchResult) {
        card.addEventListener('click', () => openSearchResultModal(item))
    } else {
        card.addEventListener('click', () => openMediaModal(item))
    }

    return card
}

// ===== FORMATO DE STATUS =====
function formatStatus(status) {
    const map = {
        'pending': '🕐 Pendiente',
        'in_progress': '▶️ En progreso',
        'completed': '✅ Completado'
    }
    return map[status] || status
}

// ===== FILTROS DE CATEGORÍA =====
function setupCategoryFilters() {
    const items = document.querySelectorAll('.category__item')
    items.forEach(item => {
        item.addEventListener('click', () => {
            items.forEach(i => i.classList.remove('active'))
            item.classList.add('active')
            activeCategoryId = item.dataset.category
            const name = item.textContent
            catalogTitle.textContent = name === 'Todo' ? 'Todo el catálogo' : name
            searchResults.classList.add('hidden')
            searchInput.value = ''
            if (!miListaSection.classList.contains('hidden')) {
                const categoryNames = {
                    '': 'Mi Lista — Todo',
                    '1': 'Mi Lista — Series',
                    '2': 'Mi Lista — Películas',
                    '3': 'Mi Lista — Videojuegos',
                    '4': 'Mi Lista — Lecturas'
                }
                document.querySelector('#mi-lista-section .section__title').textContent =
                    categoryNames[activeCategoryId] || 'Mi Lista'
                loadMyList()
            } else {
                loadCatalog(activeCategoryId)
            }
        })
    })
}

// ===== BÚSQUEDA GENERAL =====
if (btnSearch) {
    btnSearch.addEventListener('click', () => {
        currentSearchPage = 1
        searchMedia()
    })
}

if (searchInput) {
    searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            currentSearchPage = 1
            searchMedia()
        }
    })
}

async function searchMedia() {
    const query = searchInput.value.trim()
    if (!query) return

    currentSearchQuery = query

    if (currentSearchPage === 1) {
        searchGrid.innerHTML = '<p style="color:var(--color-text-muted)">Buscando...</p>'
    }

    searchResults.classList.remove('hidden')

    try {
        let url = ''

        if (activeCategoryId === '3') {
            currentSearchType = 'rawg'
            url = `${API}/media/search/rawg?q=${encodeURIComponent(query)}&page=${currentSearchPage}`
        } else if (activeCategoryId === '4') {
            currentSearchType = 'books'
            url = `${API}/media/search/books?q=${encodeURIComponent(query)}&page=${currentSearchPage}`
        } else {
            currentSearchType = 'tmdb'
            let searchType = 'multi'
            if (activeCategoryId === '1') searchType = 'tv'
            if (activeCategoryId === '2') searchType = 'movie'
            url = `${API}/media/search/tmdb?q=${encodeURIComponent(query)}&type=${searchType}&page=${currentSearchPage}`
        }

        const res = await fetch(url)
        const data = await res.json()

        if (currentSearchPage === 1) searchGrid.innerHTML = ''

        const results = data.results || []

        if (results.length === 0 && currentSearchPage === 1) {
            searchGrid.innerHTML = '<p style="color:var(--color-text-muted)">Sin resultados</p>'
            return
        }

        results.forEach(item => {
            searchGrid.appendChild(createCard(item, true))
        })

        const existingBtn = document.getElementById('btn-load-more')
        if (existingBtn) existingBtn.remove()

        const totalPages = data.total_pages || 1
        const hasNext = data.has_next !== undefined ? data.has_next : currentSearchPage < totalPages

        if (hasNext || currentSearchPage < totalPages) {
            const loadMoreBtn = document.createElement('button')
            loadMoreBtn.id = 'btn-load-more'
            loadMoreBtn.className = 'btn btn--outline'
            loadMoreBtn.style.cssText = 'display:block;margin:1.5rem auto;padding:0.75rem 2rem'
            loadMoreBtn.textContent = 'Cargar más resultados'
            loadMoreBtn.addEventListener('click', () => {
                currentSearchPage++
                searchMedia()
            })
            searchResults.appendChild(loadMoreBtn)
        }

    } catch (err) {
        console.error('Error buscando:', err)
    }
}

// ===== MODAL RESULTADO DE BÚSQUEDA =====
function openSearchResultModal(item) {
    const tmdbType = item.type
    let selectedCategory = ''
    let categoryName = ''
    if (tmdbType === 'movie') {
        selectedCategory = '2'  // Películas
        categoryName = 'Película'
    } else if (tmdbType === 'tv') {
        selectedCategory = '1'  // Series
        categoryName = 'Serie'
    } else if (tmdbType === 'game') {
        selectedCategory = '3'  // Videojuegos
        categoryName = 'Videojuego'
    } else if (tmdbType === 'book' || tmdbType === 'manga') {
        selectedCategory = '4'  // Lecturas
        categoryName = tmdbType === 'book' ? 'Libro' : 'Manga'
    }
    if (tmdbType === 'multi' && activeCategoryId) {
        selectedCategory = activeCategoryId
        if (activeCategoryId === '1') categoryName = 'Serie'
        else if (activeCategoryId === '2') categoryName = 'Película'
        else if (activeCategoryId === '3') categoryName = 'Videojuego'
        else if (activeCategoryId === '4') categoryName = 'Lectura'
    }

    if (!selectedCategory) {
        alert('No se pudo determinar la categoría de este contenido')
        return
    }
    const categoryOptions = `
        <option value="1" ${selectedCategory === '1' ? 'selected' : ''} ${tmdbType === 'tv' || (tmdbType === 'multi' && activeCategoryId === '1') ? '' : 'disabled'}>Series</option>
        <option value="2" ${selectedCategory === '2' ? 'selected' : ''} ${tmdbType === 'movie' || (tmdbType === 'multi' && activeCategoryId === '2') ? '' : 'disabled'}>Películas</option>
        <option value="3" ${selectedCategory === '3' ? 'selected' : ''} ${tmdbType === 'game' || (tmdbType === 'multi' && activeCategoryId === '3') ? '' : 'disabled'}>Videojuegos</option>
        <option value="4" ${selectedCategory === '4' ? 'selected' : ''} ${tmdbType === 'book' || tmdbType === 'manga' || (tmdbType === 'multi' && activeCategoryId === '4') ? '' : 'disabled'}>Lecturas</option>
    `

    modalBody.innerHTML = `
        <div style="display:flex;gap:1rem;margin-bottom:1rem">
            ${item.cover_url
                ? `<img src="${item.cover_url}" style="width:100px;border-radius:8px;object-fit:cover" alt="${escapeHtml(item.title)}"/>`
                : `<div style="width:100px;height:150px;background:var(--color-border);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:2rem">🎬</div>`
            }
            <div>
                <h2 style="margin-bottom:0.5rem">${escapeHtml(item.title)}</h2>
                <p style="color:var(--color-text-muted);font-size:0.9rem">${item.year || ''}</p>
                <p style="color:var(--color-primary);font-size:0.9rem;font-weight:600;margin-top:0.3rem">
                    🏷️ Tipo: ${categoryName}
                </p>
                <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.5rem">${escapeHtml(item.description || '')}</p>
            </div>
        </div>
        ${token ? `
            <div class="form__group">
                <label style="font-size:0.85rem;color:var(--color-text-muted)">Categoría</label>
                <select id="modal-category" class="form__input" style="margin-top:0.4rem;background-color:var(--color-surface-light)" disabled>
                    ${categoryOptions}
                </select>
                <p style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.2rem;font-style:italic">
                    ⚡ La categoría está fijada según el tipo de contenido y no puede modificarse
                </p>
                <input type="hidden" id="modal-category-value" value="${selectedCategory}">
            </div>
            <div class="form__group">
                <label style="font-size:0.85rem;color:var(--color-text-muted)">Estado</label>
                <select id="modal-status" class="form__input" style="margin-top:0.4rem">
                    <option value="pending">Pendiente</option>
                    <option value="in_progress">En progreso</option>
                    <option value="completed">Completado</option>
                </select>
            </div>
            <div class="form__group">
                <label style="font-size:0.85rem;color:var(--color-text-muted)">Calificación (1-10)</label>
                <input type="number" id="modal-rating" class="form__input" min="1" max="10" placeholder="8.5" style="margin-top:0.4rem"/>
            </div>
            <div class="form__group">
                <label style="font-size:0.85rem;color:var(--color-text-muted)">Reseña</label>
                <textarea id="modal-review" class="form__input" rows="3" placeholder="Tu opinión..." style="margin-top:0.4rem;resize:none"></textarea>
            </div>
            <button class="btn btn--primary btn--full" id="btn-add-to-list">Agregar a mi lista</button>
            <p class="form__error hidden" id="modal-error"></p>
        ` : `<p style="color:var(--color-text-muted);text-align:center">Inicia sesión para agregar a tu lista</p>`}
    `

    modal.classList.remove('hidden')

    if (token) {
        document.getElementById('btn-add-to-list').addEventListener('click', () => {
            const categoryId = parseInt(document.getElementById('modal-category-value').value)
            addToList(item, categoryId)
        })
    }
}

// ===== AGREGAR A LISTA =====
async function addToList(item, categoryId) {
    const status = document.getElementById('modal-status').value
    const rating = parseFloat(document.getElementById('modal-rating').value) || null
    const review = document.getElementById('modal-review').value

    try {
        const mediaRes = await fetch(`${API}/media/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: item.title,
                cover_url: item.cover_url,
                category_id: categoryId,
                year: item.year ? parseInt(item.year) : null,
                description: item.description
            })
        })

        if (!mediaRes.ok) {
            throw new Error('Error al crear/obtener el título')
        }

        const mediaData = await mediaRes.json()
        const mediaId = mediaData.id
        const checkRes = await fetch(`${API}/entries/check/${mediaId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        
        if (!checkRes.ok) {
            const myListRes = await fetch(`${API}/entries/my`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const myList = await myListRes.json()
            const alreadyInList = myList.some(entry => entry.media_id === mediaId)
            
            if (alreadyInList) {
                alert('Ya tienes este título en tu lista')
                closeModal()
                return
            }
        } else {
            const checkData = await checkRes.json()
            if (checkData.exists) {
                alert('Ya tienes este título en tu lista')
                closeModal()
                return
            }
        }
        
        // Agregar a mi lista
        const entryRes = await fetch(`${API}/entries/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                media_id: mediaId, 
                status, 
                rating, 
                review 
            })
        })

        if (entryRes.ok) {
            alert('¡Título agregado a tu lista!')
            closeModal()
            if (!miListaSection.classList.contains('hidden')) {
                loadMyList()
            } else {
                loadCatalog(activeCategoryId)
            }
        } else {
            const err = await entryRes.json()
            alert(err.error || 'Error al agregar a tu lista')
        }
    } catch (err) {
        console.error('Error agregando:', err)
        alert('Error al conectar con el servidor')
    }
}

// ===== MODAL MEDIA EXISTENTE =====
function openMediaModal(item) {
    modalBody.innerHTML = `
        <div style="display:flex;gap:1rem;margin-bottom:1rem">
            ${item.cover_url
                ? `<img src="${item.cover_url}" style="width:100px;border-radius:8px;object-fit:cover" alt="${escapeHtml(item.title)}"/>`
                : `<div style="width:100px;height:150px;background:var(--color-border);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:2rem">🎬</div>`
            }
            <div>
                <h2 style="margin-bottom:0.5rem">${escapeHtml(item.title)}</h2>
                <p style="color:var(--color-text-muted);font-size:0.9rem">${item.year || ''}</p>
                ${item.rating ? `<p style="color:var(--color-primary);font-weight:600">⭐ ${item.rating}/10</p>` : ''}
                ${item.status ? `<p style="color:var(--color-text-muted);font-size:0.85rem">${formatStatus(item.status)}</p>` : ''}
                <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.5rem">${escapeHtml(item.description || '')}</p>
            </div>
        </div>
        ${item.review ? `<p style="font-style:italic;color:var(--color-text-muted)">"${escapeHtml(item.review)}"</p>` : ''}
    `
    modal.classList.remove('hidden')
}

// ===== CERRAR MODALES =====
function closeModal() {
    modal.classList.add('hidden')
}

if (modalClose) modalClose.addEventListener('click', closeModal)
if (modalOverlay) modalOverlay.addEventListener('click', closeModal)
if (loginClose) loginClose.addEventListener('click', () => modalLogin.classList.add('hidden'))
if (loginOverlay) loginOverlay.addEventListener('click', () => modalLogin.classList.add('hidden'))

// ===== LOGIN =====
if (btnLogin) {
    btnLogin.addEventListener('click', () => {
        modalLogin.classList.remove('hidden')
        loginError.classList.add('hidden')
        inputUsername.value = ''
        inputPassword.value = ''
    })
}

if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        token = null
        currentUser = null
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        updateAuthUI()
    })
}

if (btnSubmitLogin) {
    btnSubmitLogin.addEventListener('click', async () => {
        const username = inputUsername.value.trim()
        const password = inputPassword.value.trim()

        if (!username || !password) return

        try {
            const res = await fetch(`${API}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })

            const data = await res.json()

            if (res.ok) {
                token = data.token
                currentUser = { username: data.username, role: data.role }
                localStorage.setItem('token', token)
                localStorage.setItem('user', JSON.stringify(currentUser))
                modalLogin.classList.add('hidden')
                updateAuthUI()
            } else {
                loginError.classList.remove('hidden')
            }
        } catch (err) {
            console.error('Error en login:', err)
        }
    })
}

// ===== MI LISTA =====
if (btnMiLista) {
    btnMiLista.addEventListener('click', () => {
        const searchResultsSection = document.getElementById('search-results')
        if (searchResultsSection) {
            searchResultsSection.classList.add('hidden')
        }
        mainSection.classList.add('hidden')
        heroSection.classList.add('hidden')
        miListaSection.classList.remove('hidden')
        const categoryNames = {
            '': 'Mi Lista — Todo',
            '1': 'Mi Lista — Series',
            '2': 'Mi Lista — Películas',
            '3': 'Mi Lista — Videojuegos',
            '4': 'Mi Lista — Lecturas'
        }
        document.querySelector('#mi-lista-section .section__title').textContent = 
            categoryNames[activeCategoryId] || 'Mi Lista'

        loadMyList()
    })
}

// ===== CARGAR MI LISTA =====
async function loadMyList() {
    miListaGrid.innerHTML = ''
    miListaEmpty.classList.add('hidden')

    try {
        const res = await fetch(`${API}/entries/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        const data = await res.json()
        const filtered = activeCategoryId
            ? data.filter(e => String(e.category_id) === String(activeCategoryId))
            : data

        if (filtered.length === 0) {
            miListaEmpty.classList.remove('hidden')
            return
        }

        filtered.forEach(entry => {
            miListaGrid.appendChild(createMyListCard(entry))
        })
    } catch (err) {
        console.error('Error cargando mi lista:', err)
    }
}

// ===== CREAR CARD PARA MI LISTA =====
function createMyListCard(entry) {
    const card = document.createElement('div')
    card.classList.add('card')

    const cover = entry.cover_url
        ? `<img class="card__cover" src="${entry.cover_url}" alt="${escapeHtml(entry.title)}" loading="lazy"/>`
        : `<div class="card__cover--placeholder">🎬</div>`
    let categoryDisplay = ''
    if (entry.category_id === 1) {
        categoryDisplay = '<span style="color: #4299e1; font-size: 0.75rem; display: block; margin-bottom: 0.2rem;">📺 Serie</span>'
    } else if (entry.category_id === 2) {
        categoryDisplay = '<span style="color: #48bb78; font-size: 0.75rem; display: block; margin-bottom: 0.2rem;">🎬 Película</span>'
    } else if (entry.category_id === 3) {
        categoryDisplay = '<span style="color: #ed8936; font-size: 0.75rem; display: block; margin-bottom: 0.2rem;">🎮 Videojuego</span>'
    } else if (entry.category_id === 4) {
        categoryDisplay = '<span style="color: #9f7aea; font-size: 0.75rem; display: block; margin-bottom: 0.2rem;">📚 Lectura</span>'
    }
    const review = entry.review ? entry.review.replace(/'/g, "\\'").replace(/`/g, "\\`") : ''
    const rating = entry.rating !== null ? entry.rating : 'null'

    card.innerHTML = `
        ${cover}
        <div class="card__info">
            <p class="card__title">${escapeHtml(entry.title)}</p>
            ${categoryDisplay}
            ${entry.rating ? `<p class="card__rating">⭐ ${entry.rating}/10</p>` : ''}
            <p class="card__status">${formatStatus(entry.status)}</p>
            <div style="display:flex;gap:0.4rem;margin-top:0.5rem">
                <button class="btn btn--outline" style="font-size:0.75rem;padding:0.3rem 0.6rem" 
                    onclick="openEditModal(${entry.entry_id}, ${rating}, '${entry.status}', '${review}')">
                    ✏️ Editar
                </button>
                <button class="btn" style="font-size:0.75rem;padding:0.3rem 0.6rem;background:var(--color-danger);color:white" 
                    onclick="deleteEntry(${entry.entry_id})">
                    🗑️ Borrar
                </button>
            </div>
        </div>
    `
    return card
}

// ===== EDITAR ENTRADA =====
function openEditModal(entryId, rating, status, review) {
    modalBody.innerHTML = `
        <h2 style="margin-bottom:1.5rem;color:var(--color-primary)">Editar entrada</h2>
        <div class="form__group">
            <label style="font-size:0.85rem;color:var(--color-text-muted)">Estado</label>
            <select id="edit-status" class="form__input" style="margin-top:0.4rem">
                <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pendiente</option>
                <option value="in_progress" ${status === 'in_progress' ? 'selected' : ''}>En progreso</option>
                <option value="completed" ${status === 'completed' ? 'selected' : ''}>Completado</option>
            </select>
        </div>
        <div class="form__group">
            <label style="font-size:0.85rem;color:var(--color-text-muted)">Calificación (1-10)</label>
            <input type="number" id="edit-rating" class="form__input" 
                min="1" max="10" value="${rating !== 'null' ? rating : ''}" style="margin-top:0.4rem"/>
        </div>
        <div class="form__group">
            <label style="font-size:0.85rem;color:var(--color-text-muted)">Reseña</label>
            <textarea id="edit-review" class="form__input" rows="3" 
                style="margin-top:0.4rem;resize:none">${review || ''}</textarea>
        </div>
        <button class="btn btn--primary btn--full" id="btn-save-edit">Guardar cambios</button>
    `

    modal.classList.remove('hidden')

    document.getElementById('btn-save-edit').addEventListener('click', async () => {
        const newStatus = document.getElementById('edit-status').value
        const newRating = parseFloat(document.getElementById('edit-rating').value) || null
        const newReview = document.getElementById('edit-review').value

        try {
            const res = await fetch(`${API}/entries/${entryId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    status: newStatus,
                    rating: newRating,
                    review: newReview
                })
            })

            if (res.ok) {
                alert('Cambios guardados')
                closeModal()
                loadMyList()
            } else {
                const error = await res.json()
                alert(error.error || 'Error al guardar cambios')
            }
        } catch (err) {
            console.error('Error editando:', err)
            alert('Error al conectar con el servidor')
        }
    })
}

// ===== ELIMINAR ENTRADA =====
async function deleteEntry(entryId) {
    if (!confirm('¿Seguro que quieres eliminar este título de tu lista?')) return

    try {
        const res = await fetch(`${API}/entries/${entryId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        })

        if (res.ok) {
            alert('Título eliminado de tu lista')
            loadMyList()
        } else {
            const error = await res.json()
            alert(error.error || 'Error al eliminar')
        }
    } catch (err) {
        console.error('Error eliminando:', err)
        alert('Error al conectar con el servidor')
    }
}

// ===== VOLVER A CATÁLOGO =====
if (btnVolver) {
    btnVolver.addEventListener('click', () => {
        miListaSection.classList.add('hidden')
        mainSection.classList.remove('hidden')
        heroSection.classList.remove('hidden')
        searchResults.classList.add('hidden')
    })
}
// ===== TABS LOGIN / REGISTRO =====
const tabLogin = document.getElementById('tab-login')
const tabRegister = document.getElementById('tab-register')
const formLogin = document.getElementById('form-login')
const formRegister = document.getElementById('form-register')

if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => {
        tabLogin.style.color = 'var(--color-primary)'
        tabLogin.style.borderBottom = '2px solid var(--color-primary)'
        tabRegister.style.color = 'var(--color-text-muted)'
        tabRegister.style.borderBottom = '2px solid transparent'
        formLogin.classList.remove('hidden')
        formRegister.classList.add('hidden')
    })

    tabRegister.addEventListener('click', () => {
        tabRegister.style.color = 'var(--color-primary)'
        tabRegister.style.borderBottom = '2px solid var(--color-primary)'
        tabLogin.style.color = 'var(--color-text-muted)'
        tabLogin.style.borderBottom = '2px solid transparent'
        formRegister.classList.remove('hidden')
        formLogin.classList.add('hidden')
    })
}

// ===== REGISTRO =====
const btnSubmitRegister = document.getElementById('btn-submit-register')
const registerError = document.getElementById('register-error')
const registerSuccess = document.getElementById('register-success')

if (btnSubmitRegister) {
    btnSubmitRegister.addEventListener('click', async () => {
        const username = document.getElementById('reg-username').value.trim()
        const password = document.getElementById('reg-password').value.trim()
        const password2 = document.getElementById('reg-password2').value.trim()

        registerError.classList.add('hidden')
        registerSuccess.classList.add('hidden')

        if (!username || !password) {
            registerError.textContent = 'Completa todos los campos'
            registerError.classList.remove('hidden')
            return
        }

        if (password !== password2) {
            registerError.textContent = 'Las contraseñas no coinciden'
            registerError.classList.remove('hidden')
            return
        }

        if (password.length < 6) {
            registerError.textContent = 'La contraseña debe tener al menos 6 caracteres'
            registerError.classList.remove('hidden')
            return
        }

        try {
            const res = await fetch(`${API}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })

            const data = await res.json()

            if (res.ok) {
                registerSuccess.classList.remove('hidden')
                document.getElementById('reg-username').value = ''
                document.getElementById('reg-password').value = ''
                document.getElementById('reg-password2').value = ''
                setTimeout(() => {
                    tabLogin.click()
                    registerSuccess.classList.add('hidden')
                }, 2000)
            } else {
                registerError.textContent = data.error || 'Error al crear cuenta'
                registerError.classList.remove('hidden')
            }
        } catch (err) {
            registerError.textContent = 'Error al conectar con el servidor'
            registerError.classList.remove('hidden')
        }
    })
}
// ===== PERFIL =====
const btnPerfil = document.getElementById('btn-perfil')
const perfilSection = document.getElementById('perfil-section')
const btnVolverPerfil = document.getElementById('btn-volver-perfil')

if (btnPerfil) {
    btnPerfil.addEventListener('click', () => {
        mainSection.classList.add('hidden')
        heroSection.classList.add('hidden')
        miListaSection.classList.add('hidden')
        searchResults.classList.add('hidden')
        perfilSection.classList.remove('hidden')
        loadPerfil()
    })
}

if (btnVolverPerfil) {
    btnVolverPerfil.addEventListener('click', () => {
        perfilSection.classList.add('hidden')
        mainSection.classList.remove('hidden')
        heroSection.classList.remove('hidden')
    })
}

async function loadPerfil() {
    try {
        const res = await fetch(`${API}/entries/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        const data = await res.json()

        // TARJETAS GENERALES
        const statsCards = document.getElementById('stats-cards')
        statsCards.innerHTML = `
            <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:1.25rem;text-align:center">
                <div style="font-size:2rem;font-weight:800;color:var(--color-primary)">${data.total}</div>
                <div style="font-size:0.85rem;color:var(--color-text-muted);margin-top:0.3rem">Total títulos</div>
            </div>
            <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:1.25rem;text-align:center">
                <div style="font-size:2rem;font-weight:800;color:var(--color-primary)">${data.promedio_general || '—'}</div>
                <div style="font-size:0.85rem;color:var(--color-text-muted);margin-top:0.3rem">Promedio general</div>
            </div>
            <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:1.25rem;text-align:center">
                <div style="font-size:2rem;font-weight:800;color:#48bb78">${data.por_estado.completed}</div>
                <div style="font-size:0.85rem;color:var(--color-text-muted);margin-top:0.3rem">Completados</div>
            </div>
            <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:1.25rem;text-align:center">
                <div style="font-size:2rem;font-weight:800;color:#ed8936">${data.por_estado.in_progress}</div>
                <div style="font-size:0.85rem;color:var(--color-text-muted);margin-top:0.3rem">En progreso</div>
            </div>
            <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:1.25rem;text-align:center">
                <div style="font-size:2rem;font-weight:800;color:var(--color-text-muted)">${data.por_estado.pending}</div>
                <div style="font-size:0.85rem;color:var(--color-text-muted);margin-top:0.3rem">Pendientes</div>
            </div>
        `

        // POR CATEGORÍA
        const categorias = {
            '1': { nombre: 'Series', emoji: '📺', color: '#4299e1' },
            '2': { nombre: 'Películas', emoji: '🎬', color: '#48bb78' },
            '3': { nombre: 'Videojuegos', emoji: '🎮', color: '#ed8936' },
            '4': { nombre: 'Lecturas', emoji: '📚', color: '#9f7aea' }
        }
        const statsCategorias = document.getElementById('stats-categorias')
        statsCategorias.innerHTML = ''
        const totalCat = Object.values(data.por_categoria).reduce((a, b) => a + b, 0) || 1

        for (const [id, cat] of Object.entries(categorias)) {
            const count = data.por_categoria[id] || 0
            const pct = Math.round((count / totalCat) * 100)
            statsCategorias.innerHTML += `
                <div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:0.3rem">
                        <span style="font-size:0.9rem">${cat.emoji} ${cat.nombre}</span>
                        <span style="font-size:0.9rem;color:var(--color-text-muted)">${count}</span>
                    </div>
                    <div style="background:var(--color-border);border-radius:20px;height:8px;overflow:hidden">
                        <div style="width:${pct}%;height:100%;background:${cat.color};border-radius:20px;transition:width 0.5s"></div>
                    </div>
                </div>
            `
        }

        // POR ESTADO
        const estados = [
            { key: 'completed', nombre: 'Completados', emoji: '✅', color: '#48bb78' },
            { key: 'in_progress', nombre: 'En progreso', emoji: '▶️', color: '#ed8936' },
            { key: 'pending', nombre: 'Pendientes', emoji: '🕐', color: 'var(--color-text-muted)' }
        ]
        const statsEstados = document.getElementById('stats-estados')
        statsEstados.innerHTML = ''
        const totalEst = data.total || 1

        for (const est of estados) {
            const count = data.por_estado[est.key] || 0
            const pct = Math.round((count / totalEst) * 100)
            statsEstados.innerHTML += `
                <div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:0.3rem">
                        <span style="font-size:0.9rem">${est.emoji} ${est.nombre}</span>
                        <span style="font-size:0.9rem;color:var(--color-text-muted)">${count}</span>
                    </div>
                    <div style="background:var(--color-border);border-radius:20px;height:8px;overflow:hidden">
                        <div style="width:${pct}%;height:100%;background:${est.color};border-radius:20px;transition:width 0.5s"></div>
                    </div>
                </div>
            `
        }

        // TOP CALIFICADOS
        const statsTop = document.getElementById('stats-top')
        const statsTopEmpty = document.getElementById('stats-top-empty')
        statsTop.innerHTML = ''

        if (data.top_calificados.length === 0) {
            statsTopEmpty.classList.remove('hidden')
        } else {
            statsTopEmpty.classList.add('hidden')
            data.top_calificados.forEach(item => {
                const card = document.createElement('div')
                card.classList.add('card')
                const cover = item.cover_url
                    ? `<img class="card__cover" src="${item.cover_url}" alt="${escapeHtml(item.title)}" loading="lazy"/>`
                    : `<div class="card__cover--placeholder">🎬</div>`
                card.innerHTML = `
                    ${cover}
                    <div class="card__info">
                        <p class="card__title">${escapeHtml(item.title)}</p>
                        <p class="card__rating">⭐ ${item.rating}/10</p>
                        <p class="card__status">${formatStatus(item.status)}</p>
                    </div>
                `
                statsTop.appendChild(card)
            })
        }

    } catch (err) {
        console.error('Error cargando perfil:', err)
    }
}