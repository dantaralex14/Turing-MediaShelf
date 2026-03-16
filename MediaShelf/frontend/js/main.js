// ===== ESTADO GLOBAL =====
const API = 'http://127.0.0.1:5000/api'
let token = localStorage.getItem('token') || null
let currentUser = JSON.parse(localStorage.getItem('user') || 'null')
let activeCategoryId = ''

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

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI()
    loadCatalog()
    setupCategoryFilters()
})

// ===== AUTH UI =====
function updateAuthUI() {
    if (token && currentUser) {
        btnLogin.classList.add('hidden')
        btnLogout.classList.remove('hidden')
        btnLogout.textContent = `Salir (${currentUser.username})`
    } else {
        btnLogin.classList.remove('hidden')
        btnLogout.classList.add('hidden')
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

// ===== CREAR CARD =====
function createCard(item, isSearchResult = false) {
    const card = document.createElement('div')
    card.classList.add('card')

    const cover = item.cover_url
        ? `<img class="card__cover" src="${item.cover_url}" alt="${item.title}" loading="lazy"/>`
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
            <p class="card__title">${item.title}</p>
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
            loadCatalog(activeCategoryId)
        })
    })
}

// ===== BÚSQUEDA TMDB =====
btnSearch.addEventListener('click', searchTMDB)
searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchTMDB()
})

async function searchTMDB() {
    const query = searchInput.value.trim()
    if (!query) return

    searchGrid.innerHTML = '<p style="color:var(--color-text-muted)">Buscando...</p>'
    searchResults.classList.remove('hidden')

    try {
        const res = await fetch(`${API}/media/search/tmdb?q=${encodeURIComponent(query)}`)
        const data = await res.json()

        searchGrid.innerHTML = ''

        if (data.length === 0) {
            searchGrid.innerHTML = '<p style="color:var(--color-text-muted)">Sin resultados</p>'
            return
        }

        data.forEach(item => {
            searchGrid.appendChild(createCard(item, true))
        })
    } catch (err) {
        console.error('Error buscando:', err)
    }
}

// ===== MODAL RESULTADO DE BÚSQUEDA =====
function openSearchResultModal(item) {
    const categoryOptions = `
        <option value="1">Series</option>
        <option value="2">Películas</option>
        <option value="3">Videojuegos</option>
        <option value="4">Lecturas</option>
    `

    modalBody.innerHTML = `
        <div style="display:flex;gap:1rem;margin-bottom:1rem">
            ${item.cover_url
                ? `<img src="${item.cover_url}" style="width:100px;border-radius:8px;object-fit:cover"/>`
                : `<div style="width:100px;height:150px;background:var(--color-border);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:2rem">🎬</div>`
            }
            <div>
                <h2 style="margin-bottom:0.5rem">${item.title}</h2>
                <p style="color:var(--color-text-muted);font-size:0.9rem">${item.year || ''}</p>
                <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.5rem">${item.description || ''}</p>
            </div>
        </div>
        ${token ? `
            <div class="form__group">
                <label style="font-size:0.85rem;color:var(--color-text-muted)">Categoría</label>
                <select id="modal-category" class="form__input" style="margin-top:0.4rem">
                    ${categoryOptions}
                </select>
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
            addToList(item)
        })
    }
}

// ===== AGREGAR A LISTA =====
async function addToList(item) {
    const categoryId = parseInt(document.getElementById('modal-category').value)
    const status = document.getElementById('modal-status').value
    const rating = parseFloat(document.getElementById('modal-rating').value) || null
    const review = document.getElementById('modal-review').value

    // Primero agregar el media si no existe
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

        const mediaData = await mediaRes.json()
        const mediaId = mediaData.id

        // Luego crear la entry
        const entryRes = await fetch(`${API}/entries/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ media_id: mediaId, status, rating, review })
        })

        if (entryRes.ok) {
            closeModal()
            loadCatalog(activeCategoryId)
        } else {
            const err = await entryRes.json()
            const modalError = document.getElementById('modal-error')
            modalError.textContent = err.error
            modalError.classList.remove('hidden')
        }
    } catch (err) {
        console.error('Error agregando:', err)
    }
}

// ===== MODAL MEDIA EXISTENTE =====
function openMediaModal(item) {
    modalBody.innerHTML = `
        <div style="display:flex;gap:1rem;margin-bottom:1rem">
            ${item.cover_url
                ? `<img src="${item.cover_url}" style="width:100px;border-radius:8px;object-fit:cover"/>`
                : `<div style="width:100px;height:150px;background:var(--color-border);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:2rem">🎬</div>`
            }
            <div>
                <h2 style="margin-bottom:0.5rem">${item.title}</h2>
                <p style="color:var(--color-text-muted);font-size:0.9rem">${item.year || ''}</p>
                ${item.rating ? `<p style="color:var(--color-primary);font-weight:600">⭐ ${item.rating}/10</p>` : ''}
                ${item.status ? `<p style="color:var(--color-text-muted);font-size:0.85rem">${formatStatus(item.status)}</p>` : ''}
                <p style="color:var(--color-text-muted);font-size:0.85rem;margin-top:0.5rem">${item.description || ''}</p>
            </div>
        </div>
        ${item.review ? `<p style="font-style:italic;color:var(--color-text-muted)">"${item.review}"</p>` : ''}
    `
    modal.classList.remove('hidden')
}

// ===== CERRAR MODALES =====
function closeModal() {
    modal.classList.add('hidden')
}

modalClose.addEventListener('click', closeModal)
modalOverlay.addEventListener('click', closeModal)

loginClose.addEventListener('click', () => modalLogin.classList.add('hidden'))
loginOverlay.addEventListener('click', () => modalLogin.classList.add('hidden'))

// ===== LOGIN =====
btnLogin.addEventListener('click', () => {
    modalLogin.classList.remove('hidden')
    loginError.classList.add('hidden')
    inputUsername.value = ''
    inputPassword.value = ''
})

btnLogout.addEventListener('click', () => {
    token = null
    currentUser = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    updateAuthUI()
})

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