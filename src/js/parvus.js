export default function parvus (userOptions) {
  /**
   * Global variables
   *
   */
  const BROWSER_WINDOW = window
  const FOCUSABLE_ELEMENTS = [
    'button:not([disabled]):not([inert])',
    '[tabindex]:not([tabindex^='-']):not([inert])'
  ]
  let config = {}
  let lightbox = null
  let lightboxOverlay = null
  let lightboxImageContainer = null
  let lightboxImage = null
  let widthDifference
  let heightDifference
  let xDifference
  let yDifference
  let loadingIndicator = null
  let drag = {}
  let isDraggingY = false
  let pointerDown = false
  let lastFocus = null

  /**
   * Merge default options with user options
   *
   * @param {Object} userOptions - Optional user options
   * @returns {Object} - Custom options
   */
  const mergeOptions = function mergeOptions (userOptions) {
    // Default options
    const OPTIONS = {
      selector: '.lightbox',
      lightboxLabel: 'This is a dialog window which overlays the main content of the page. The modal shows the enlarged image. Pressing the Escape key will close the modal and bring you back to where you were on the page.',
      lightboxLoadingIndicatorLabel: 'Image loading',
      swipeClose: true,
      scrollClose: true,
      threshold: 100,
      transitionDuration: 300,
      transitionTimingFunction: 'cubic-bezier(0.2, 0, 0.2, 1)'
    }

    return {
      ...OPTIONS, ...userOptions
    }
  }

  /**
   * Check prefers reduced motion
   *
   */
  const MOTIONQUERY = window.matchMedia('(prefers-reduced-motion)')

  const reducedMotionCheck = function reducedMotionCheck () {
    return MOTIONQUERY.matches
  }

  /**
   * Init
   *
   */
  const init = function init (userOptions) {
    // Merge user options into defaults
    config = mergeOptions(userOptions)

    // Check if the lightbox already exists
    if (!lightbox) {
      createLightbox()
    }

    // Get a list of all elements within the document
    const LIGHTBOX_TRIGGER_ELS = document.querySelectorAll(config.selector)

    // Execute a few things once per element
    LIGHTBOX_TRIGGER_ELS.forEach(lightboxTriggerEl => {
      add(lightboxTriggerEl)
    })
  }

  /**
   * Add element
   *
   * @param {HTMLElement} el - Element to add
   */
  const add = function add (el) {
    if (!el.classList.contains('parvus-zoom')) {
      el.classList.add('parvus-zoom')

      // Bind click event handler
      el.addEventListener('click', triggerParvus)
    }
  }

  /**
   * Remove element
   *
   * @param {HTMLElement} el - Element to remove
   */
  const remove = function remove (el) {
    if (el.classList.contains('parvus-zoom')) {
      el.classList.remove('parvus-zoom')

      // Unbind click event handler
      el.removeEventListener('click', triggerParvus)
    }
  }

  /**
   * Create the lightbox
   *
   */
  const createLightbox = function createLightbox () {
    // Create the lightbox container
    lightbox = document.createElement('div')
    lightbox.setAttribute('role', 'dialog')
    lightbox.setAttribute('aria-hidden', 'true')
    lightbox.setAttribute('tabindex', '0')
    lightbox.setAttribute('aria-label', config.lightboxLabel)
    lightbox.classList.add('parvus')

    // Create the lightbox overlay container
    lightboxOverlay = document.createElement('div')
    lightboxOverlay.classList.add('parvus__overlay')

    lightboxOverlay.style.opacity = 0

    // Add lightbox overlay container to lightbox container
    lightbox.appendChild(lightboxOverlay)

    // Create the lightbox image container
    lightboxImageContainer = document.createElement('div')
    lightboxImageContainer.classList.add('parvus__image')

    // Add lightbox image container to lightbox container
    lightbox.appendChild(lightboxImageContainer)

    // Add lightbox container to body
    document.body.appendChild(lightbox)
  }

  /**
   * Open Parvus
   *
   * @param {HTMLElement} el - Element to open
   */
  const open = function open (el) {
    if (isOpen()) {
      throw new Error('Ups, I\'m aleady open.')
    }

    // Save user’s focus
    lastFocus = document.activeElement

    if (reducedMotionCheck()) {
      config.transitionDuration = 1
    }

    // Use `history.pushState()` to make sure the 'Back' button behavior
    // that aligns with the user's expectations
    const STATE_OBJ = {
      parvus: 'close'
    }

    const URL = window.location.href

    history.pushState(STATE_OBJ, 'Image', URL)

    bindEvents()

    // Create loading indicator
    loadingIndicator = document.createElement('div')
    loadingIndicator.className = 'parvus__loader'
    loadingIndicator.setAttribute('role', 'progressbar')
    loadingIndicator.setAttribute('aria-label', config.lightboxLoadingIndicatorLabel)

    // Add loading indicator to container
    lightbox.appendChild(loadingIndicator)

    // Show lightbox
    lightbox.setAttribute('aria-hidden', 'false')

    lightbox.focus()

    // Load image
    load(el)

    // Create and dispatch a new event
    const OPEN_EVENT = new CustomEvent('open')

    lightbox.dispatchEvent(OPEN_EVENT)
  }

  /**
   * Close Parvus
   *
   */
  const close = function close () {
    if (!isOpen()) {
      throw new Error('Ups, I\'m already closed.')
    }

    unbindEvents()

    clearDrag()

    // Remove entry in browser history
    if (history.state !== null) {
      if (history.state.parvus === 'close') {
        history.back()
      }
    }

    // Create and dispatch a new event
    const CLOSE_EVENT = new CustomEvent('close')

    lightbox.dispatchEvent(CLOSE_EVENT)

    requestAnimationFrame(() => {
      lightboxImage.style.transition = `transform ${config.transitionDuration}ms ${config.transitionTimingFunction}`
      lightboxImage.style.transform = `translate(${xDifference}px, ${yDifference}px) scale(${widthDifference}, ${heightDifference})`

      lightboxOverlay.style.opacity = 0
      lightboxOverlay.style.transition = `opacity ${config.transitionDuration}ms ${config.transitionTimingFunction}`
    })

    lightboxImage.addEventListener('transitionend', () => {
      // Reenable the user’s focus
      lastFocus.focus({
        preventScroll: true
      })

      // Hide lightbox
      lightbox.setAttribute('aria-hidden', 'true')

      lightboxImage.remove()
    },
    {
      once: true
    })
  }

  /**
   * Load Image
   *
   * @param {number} index - Index to load
   */
  const load = function load (el) {
    if (!el.href.match(/\.(png|jpe?g|gif|bmp|webp|svg)(\?.*)?$/i)) {
      return
    }

    lightboxImage = document.createElement('img')

    const THUMBNAIL = el.querySelector('img')
    const THUMBNAIL_SIZE = el.getBoundingClientRect()

    lightboxImage.alt = THUMBNAIL.alt || ''
    lightboxImage.src = el.href
    lightboxImageContainer.style.opacity = '0'

    lightboxImageContainer.appendChild(lightboxImage)

    lightboxImage.onload = () => {
      lightbox.removeChild(loadingIndicator)

      const LIGHTBOX_IMAGE_SIZE = lightboxImage.getBoundingClientRect()

      widthDifference = THUMBNAIL_SIZE.width / LIGHTBOX_IMAGE_SIZE.width
      heightDifference = THUMBNAIL_SIZE.height / LIGHTBOX_IMAGE_SIZE.height
      xDifference = THUMBNAIL_SIZE.left - LIGHTBOX_IMAGE_SIZE.left
      yDifference = THUMBNAIL_SIZE.top - LIGHTBOX_IMAGE_SIZE.top

      lightboxImageContainer.style.opacity = '1'

      requestAnimationFrame(() => {
        lightboxImage.style.transform = `translate(${xDifference}px, ${yDifference}px) scale(${widthDifference}, ${heightDifference})`
        lightboxImage.style.transition = 'transform 0s'

        // Animate the difference reversal on the next tick
        requestAnimationFrame(() => {
          lightboxImage.style.transform = ''
          lightboxImage.style.transition = `transform ${config.transitionDuration}ms ${config.transitionTimingFunction}`

          lightboxOverlay.style.opacity = 1
          lightboxOverlay.style.transition = `opacity ${config.transitionDuration}ms ${config.transitionTimingFunction}`
        })
      })
    }
  }

  /**
   * Clear drag after touchend event
   *
   */
  const clearDrag = function clearDrag () {
    lightboxImageContainer.style.transform = 'translate3d(0, 0, 0)'

    drag = {
      startY: 0,
      endY: 0
    }
  }

  /**
   * Recalculate drag / swipe event
   *
   */
  const updateAfterDrag = function updateAfterDrag () {
    const MOVEMENT_Y = drag.endY - drag.startY
    const MOVEMENT_Y_DISTANCE = Math.abs(MOVEMENT_Y)

    if (MOVEMENT_Y < 0 && MOVEMENT_Y_DISTANCE > config.threshold && config.swipeClose) {
      close()
    }
  }

  /**
   * Click event handler to trigger Parvus
   *
   */
  const triggerParvus = function triggerParvus (event) {
    event.preventDefault()

    open(this)
  }

  /**
   * Click event handler
   *
   */
  const clickHandler = function clickHandler (event) {
    if (!isDraggingY) {
      close()
    }

    event.stopPropagation()
  }

  /**
   * Get the focusable children of the given element
   *
   * @return {Array<Element>}
   */
  const getFocusableChildren = function getFocusableChildren () {
    return Array.prototype.slice.call(document.querySelectorAll(`.parvus, .parvus + ${FOCUSABLE_ELEMENTS.join(', .parvus ')}`)).filter(function (child) {
      return !!(
        child.offsetWidth ||
        child.offsetHeight ||
        child.getClientRects().length
      )
    })
  }

  /**
   * Keydown event handler
   *
   */
  const keydownHandler = function keydownHandler (event) {
    const FOCUSABLE_CHILDREN = getFocusableChildren()
    const FOCUSED_ITEM_INDEX = FOCUSABLE_CHILDREN.indexOf(document.activeElement)

    if (event.code === 'Tab') {
      // If the SHIFT key is being pressed while tabbing (moving backwards) and
      // the currently focused item is the first one, move the focus to the last
      // focusable item
      if (event.shiftKey && FOCUSED_ITEM_INDEX === 0) {
        FOCUSABLE_CHILDREN[FOCUSABLE_CHILDREN.length - 1].focus()
        event.preventDefault()
        // If the SHIFT key is not being pressed (moving forwards) and the currently
        // focused item is the last one, move the focus to the first focusable item
      } else if (!event.shiftKey && FOCUSED_ITEM_INDEX === FOCUSABLE_CHILDREN.length - 1) {
        FOCUSABLE_CHILDREN[0].focus()
        event.preventDefault()
      }
    } else if (event.code === 'Escape') {
      // `ESC` Key: Close Parvus
      event.preventDefault()
      close()
    }
  }

  /**
   * Wheel event handler
   *
   */
  const wheelHandler = function wheelHandler (event) {
    close()
  }

  /**
   * Touchstart event handler
   *
   */
  const touchstartHandler = function touchstartHandler (event) {
    event.stopPropagation()

    isDraggingY = false

    pointerDown = true

    drag.startY = event.touches[0].pageY

    lightboxImageContainer.classList.add('parvus__image--is-dragging')
  }

  /**
   * Touchmove event handler
   *
   */
  const touchmoveHandler = function touchmoveHandler (event) {
    event.stopPropagation()

    if (pointerDown) {
      event.preventDefault()

      drag.endY = event.touches[0].pageY

      doSwipe()
    }
  }

  /**
   * Touchend event handler
   *
   */
  const touchendHandler = function touchendHandler (event) {
    event.stopPropagation()

    pointerDown = false

    lightboxImageContainer.classList.remove('parvus__image--is-dragging')

    if (drag.endY) {
      updateAfterDrag()
    }

    clearDrag()
  }

  /**
   * Decide whether to do vertical swipe
   *
   */
  const doSwipe = function doSwipe () {
    if (Math.abs(drag.startY - drag.endY) > 0 && config.swipeClose) {
      lightboxImageContainer.style.transform = `translate3d(0, -${Math.round(drag.startY - drag.endY)}px, 0)`

      isDraggingY = true
    }
  }

  /**
   * Bind events
   *
   */
  const bindEvents = function bindEvents () {
    BROWSER_WINDOW.addEventListener('keydown', keydownHandler)

    if (config.scrollClose) {
      BROWSER_WINDOW.addEventListener('wheel', wheelHandler)
    }

    // Popstate event
    BROWSER_WINDOW.addEventListener('popstate', close)

    // Click event
    lightbox.addEventListener('click', clickHandler)

    if (isTouchDevice()) {
      // Touch events
      lightbox.addEventListener('touchstart', touchstartHandler)
      lightbox.addEventListener('touchmove', touchmoveHandler)
      lightbox.addEventListener('touchend', touchendHandler)
    }
  }

  /**
   * Unbind events
   *
   */
  const unbindEvents = function unbindEvents () {
    BROWSER_WINDOW.removeEventListener('keydown', keydownHandler)

    if (config.scrollClose) {
      BROWSER_WINDOW.removeEventListener('wheel', wheelHandler)
    }

    // Popstate event
    BROWSER_WINDOW.removeEventListener('popstate', close)

    // Click event
    lightbox.removeEventListener('click', clickHandler)

    if (isTouchDevice()) {
      // Touch events
      lightbox.removeEventListener('touchstart', touchstartHandler)
      lightbox.removeEventListener('touchmove', touchmoveHandler)
      lightbox.removeEventListener('touchend', touchendHandler)
    }
  }

  /**
   * Destroy Parvus
   *
   */
  const destroy = function destroy () {
    if (isOpen()) {
      close()
    }

    const LIGHTBOX_TRIGGER_ELS = document.querySelectorAll('.parvus-zoom')

    LIGHTBOX_TRIGGER_ELS.forEach(lightboxTriggerEl => {
      remove(lightboxTriggerEl)
    })

    // Create and dispatch a new event
    const DESTROY_EVENT = new CustomEvent('destroy')

    lightbox.dispatchEvent(DESTROY_EVENT)
  }

  /**
   * Check if Parvus is open
   *
   */
  const isOpen = function isOpen () {
    return lightbox.getAttribute('aria-hidden') === 'false'
  }

  /**
   * Detect whether device is touch capable
   *
   */
  const isTouchDevice = function isTouchDevice () {
    return 'ontouchstart' in window
  }

  /**
   * Bind event
   * @param {String} eventName
   * @param {function} callback - callback to call
   *
   */
  const on = function on (eventName, callback) {
    lightbox.addEventListener(eventName, callback)
  }

  /**
   * Unbind event
   * @param {String} eventName
   * @param {function} callback - callback to call
   *
   */
  const off = function off (eventName, callback) {
    lightbox.removeEventListener(eventName, callback)
  }

  init(userOptions)

  parvus.init = init
  parvus.open = open
  parvus.close = close
  parvus.add = add
  parvus.remove = remove
  parvus.destroy = destroy
  parvus.isOpen = isOpen
  parvus.on = on
  parvus.off = off

  return parvus
}