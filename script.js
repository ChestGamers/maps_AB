(function () {
  var ADMIN_PASSWORD = '1234'; // Вкажите ваш пароль здесь

  function isAdmin() {
    return localStorage.getItem('map_admin_pass') === ADMIN_PASSWORD;
  }

  window.loginAdmin = function() {
    var pass = prompt('Введите пароль редактора:');
    if (pass === ADMIN_PASSWORD) {
      localStorage.setItem('map_admin_pass', pass);
      alert('Режим редактора включен!');
      location.reload();
    } else if (pass !== null) {
      alert('Неверный пароль!');
    }
  };
  window.logoutAdmin = function() {
    localStorage.removeItem('map_admin_pass');
    alert('Режим редактора выключен!');
    location.reload();
  };

  function getSafeUserId() {
    try {
      var savedId = localStorage.getItem('map_user_id');
      if (savedId) return savedId;
      var newId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      localStorage.setItem('map_user_id', newId);
      return newId;
    } catch (e) {
      return 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    }
  }

  var currentUserId = getSafeUserId();
  var map, markerGroup, currentOverlay;
  var markersData = [];
  var markerToDeleteId = null;
  var editingMarkerId = null;

  var selectedCategoryValue = 'loot';
  var selectedSubcategoryValue = 'valuable';
  var selectedIconValue = ''; 

  var CATEGORIES_CONFIG = [
    {
      id: 'loot',
      title: 'Лут',
      subcategories: [
        { 
          id: 'valuable', 
          title: 'Ценный', 
          icons: ['icon/Сейф.svg', 'icon/Маленький сейф.webp', 'icon/Электронный сейф.svg', 'icon/касса.svg'] 
        },
        { 
          id: 'military', 
          title: 'Военный', 
          icons: ['icon/Военный ПК.svg', 'icon/Большой ящик с оружием.svg', 'icon/Средний ящик с оружием.svg', 'icon/Деревянный ящик с оружием.svg', 'icon/Ящик с патронами.svg', 'icon/Ящик для гранат.svg', 'icon/Военные припасы.svg', 'icon/Длинный ящик с оружием.svg', 'icon/Сброшенный с воздуха контейнер.svg'] 
        },
        { 
          id: 'civilian', 
          title: 'Гражданский', 
          icons: ['icon/кейс с документами.svg', 'icon/Кейс для хранения.svg', 'icon/Ящики.svg', 'icon/Офисные ящики.webp', 'icon/Чемодан.svg', 'icon/Спортивная сумка.svg', 'icon/Проф. ящик с инструментами.svg', 'icon/Ящик с домашними инструментами.svg', 'icon/Деловой чемодан.svg', 'icon/homePC.svg'] 
        },
        { 
          id: 'medical', 
          title: 'Медицинский', 
          icons: ['icon/Медицинский контейнер.svg', 'icon/Сумка с медикаментами.svg', 'icon/Домашний набор первой помощи.svg', 'icon/Большой медицинский ящик.PNG'] 
        },
        { 
          id: 'clothes', 
          title: 'Одежда', 
          icons: ['icon/Куртка.svg', 'icon/Рабочая куртка.svg', 'icon/Пальто.svg', 'icon/Хим. костюм.svg'] 
        }
      ]
    },
    { id: 'key', title: 'Закрытые комнаты', icons: ['icon/key.jpeg'] },
    { id: 'extract', title: 'Точки эвакуации', icons: ['icon/Эвакуация.svg', 'icon/Платный выход.svg', 'icon/Выход с таймером.svg'] },
    { id: 'spawn', title: 'Точки появления', icons: ['icon/PlayerSpawn.svg', 'icon/BossSpawn.svg'] },
    { id: 'interact', title: 'Объекты взаимодействия', icons: ['icon/Приёмное устр. для припасов.svg'] },
    { id: 'quest', title: 'Задания', icons: [] }
  ];

  var MAPS_CONFIG = {
    farm: { title: 'Ферма', image: 'map/farm.jpg' },
    valley: { title: 'Долина', image: 'map/valley.jpg' },
    northridge: { title: 'Нортридж', image: 'map/northridge.jpg' },
    port: { title: 'Порт', image: 'map/port.jpg' },
    armory: { title: 'Арсенал (Общая)', image: 'map/armory.jpg' },
    armory_b1: { title: 'Арсенал (Подвал)', image: 'map/armory_b1.png', parent: 'armory' },
    armory_1f: { title: 'Арсенал (1 Этаж)', image: 'map/armory_1f.png', parent: 'armory' },
    armory_2f: { title: 'Арсенал (2 Этаж)', image: 'map/armory_2f.jpg', parent: 'armory' },
    tv: { title: 'ТВ', image: 'map/tv_1f.jpg' },
    tv_1f: { title: 'ТВ (1 Этаж)', image: 'map/tv_1f.jpg', parent: 'tv' },
    tv_2f: { title: 'ТВ (2 Этаж)', image: 'map/tv_2f.jpg', parent: 'tv' }
  };

  var currentMapKey = 'farm';
  var currentMapBounds = [[0, 0], [1000, 1000]];

  var activeFilters = new Set();
  CATEGORIES_CONFIG.forEach(function(cat) {
    activeFilters.add(cat.id);
    if (cat.subcategories) {
      cat.subcategories.forEach(function(sub) { activeFilters.add(sub.id); });
    }
  });

  var activeIconFilters = new Set();
  var expandedCategories = new Set(); 
  var expandedSubcategories = new Set();

  function openCenteredPopup(item) {
    var overlay = document.getElementById('custom-popup-overlay');
    var popupBody = document.getElementById('custom-popup-body');
    if (!overlay || !popupBody) return;

    var title = item.title || 'Точка';
    var desc = item.description || '';
    var imgUrl = item.image || (item.media && !item.media.match(/\.(mp4|webm|ogg|mov)/i) ? item.media : null);
    var videoUrl = item.video || (item.media && item.media.match(/\.(mp4|webm|ogg|mov)/i) ? item.media : null);

    var mediaHtml = '';
    if (imgUrl || videoUrl) {
      mediaHtml += '<div class="popup-media-container">';
      if (imgUrl) mediaHtml += '<img src="' + imgUrl + '" class="modal-media-element wide popup-media" alt="Медиа">';
      if (videoUrl) mediaHtml += '<video src="' + videoUrl + '" controls autoplay muted playsinline class="modal-media-element wide popup-media"></video>';
      mediaHtml += '</div>';
    }

    var actionBtnsHtml = '';
    if (isAdmin()) {
      actionBtnsHtml = 
        '<div class="popup-actions-container">' +
          '<button onclick="editMarker(\'' + item.id + '\')" class="popup-edit-btn">Редактировать</button>' +
          '<button onclick="deleteMarker(\'' + item.id + '\')" class="popup-delete-btn">Удалить</button>' +
        '</div>';
    }

    popupBody.innerHTML = 
      '<div style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #fff;">' + title + '</div>' +
      (desc ? '<div style="font-size: 13px; color: #ccc; margin-bottom: 12px; line-height: 1.4;">' + desc + '</div>' : '') +
      mediaHtml +
      actionBtnsHtml;

    overlay.classList.add('active');
  }

  function closeCenteredPopup() {
    var overlay = document.getElementById('custom-popup-overlay');
    var popupBody = document.getElementById('custom-popup-body');
    if (popupBody) {
      var videos = popupBody.querySelectorAll('video');
      videos.forEach(function (v) { v.pause(); v.src = ''; });
    }
    if (overlay) overlay.classList.remove('active');
  }
function startApp() {
    var mapElement = document.getElementById('map');
    if (!mapElement) return false;

    if (window.myMapInstance) {
      try { window.myMapInstance.remove(); } catch (e) {}
      window.myMapInstance = null;
    }
    if (mapElement._leaflet_id) {
      mapElement._leaflet_id = null;
      mapElement.innerHTML = '';
    }

    map = L.map('map', {
      crs: L.CRS.Simple,
      minZoom: -5,
      maxZoom: 3,
      zoomSnap: 0.1,
      attributionControl: false,
      zoomControl: false,
      maxBoundsViscosity: 1.0
    });
    window.myMapInstance = map;

    markerGroup = L.layerGroup().addTo(map);

    var popupOverlay = document.getElementById('custom-popup-overlay');
    var popupCloseBtn = document.getElementById('custom-popup-close');

    if (popupCloseBtn) popupCloseBtn.onclick = function () { closeCenteredPopup(); };
    if (popupOverlay) popupOverlay.onclick = function (e) { if (e.target.id === 'custom-popup-overlay') closeCenteredPopup(); };

    function loadMap(mapKey) {
      if (mapKey === 'tv') mapKey = 'tv_1f';

      var mapConfig = MAPS_CONFIG[mapKey];
      if (!mapConfig) return;

      currentMapKey = mapKey;

      var img = new Image();
      img.onload = function () {
        var realHeight = this.naturalHeight;
        var realWidth = this.naturalWidth;
        currentMapBounds = [[0, 0], [realHeight, realWidth]];

        if (currentOverlay) map.removeLayer(currentOverlay);

        currentOverlay = L.imageOverlay(mapConfig.image, currentMapBounds).addTo(map);
        map.setMaxBounds(currentMapBounds);
        map.fitBounds(currentMapBounds);

        var parentMap = mapConfig.parent || mapKey;

        document.querySelectorAll('.map-card').forEach(function (card) {
          if (card.getAttribute('data-map') === parentMap) card.classList.add('active');
          else card.classList.remove('active');
        });

        var armoryFloorMenu = document.getElementById('armory-floors');
        var telecenterFloorMenu = document.getElementById('telecenter-floors');

        if (armoryFloorMenu) armoryFloorMenu.style.display = 'none';
        if (telecenterFloorMenu) telecenterFloorMenu.style.display = 'none';

        if (parentMap === 'armory' && armoryFloorMenu) {
          armoryFloorMenu.style.display = 'flex';
        } else if (parentMap === 'tv' && telecenterFloorMenu) {
          telecenterFloorMenu.style.display = 'flex';
        }

        document.querySelectorAll('.floor-btn').forEach(function (btn) {
          if (btn.getAttribute('data-map') === mapKey) btn.classList.add('active');
          else btn.classList.remove('active');
        });

        renderMarkers();
      };
      img.src = mapConfig.image;
    }

    document.querySelectorAll('.map-card').forEach(function (card) {
      card.onclick = function () { loadMap(this.getAttribute('data-map')); };
    });

    document.querySelectorAll('.floor-btn').forEach(function (btn) {
      btn.onclick = function () { loadMap(this.getAttribute('data-map')); };
    });

    var categoryTree = document.getElementById('category-tree');
    var filterSearch = document.getElementById('filter-search');

    var addMarkerSection = document.getElementById('add-marker-section');
    var toggleAddMarkerBtn = document.getElementById('toggle-add-marker');
    var addMarkerArrow = document.getElementById('add-marker-arrow');

    var markerTitleInput = document.getElementById('marker-title');
    var markerCoordsInput = document.getElementById('marker-coords');
    var markerDescInput = document.getElementById('marker-desc');
    
    var markerImageFileInput = document.getElementById('marker-image-file');
    var markerVideoFileInput = document.getElementById('marker-video-file');
    var imageFileLabelText = document.getElementById('image-file-label-text');
    var videoFileLabelText = document.getElementById('video-file-label-text');

    var markerMediaInput = document.getElementById('marker-media');
    var addMarkerBtn = document.getElementById('add-marker-btn');
    var cancelEditBtn = document.getElementById('cancel-edit-btn');
    var saveJsonBtn = document.getElementById('save-json-btn');

    var confirmModal = document.getElementById('confirm-modal');
    var cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    var confirmDeleteBtn = document.getElementById('confirm-delete-btn');

    if (toggleAddMarkerBtn) {
      toggleAddMarkerBtn.onclick = function () {
        var isOpen = addMarkerSection.classList.toggle('open');
        if (addMarkerArrow) addMarkerArrow.style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0deg)';
      };
    }

    if (markerImageFileInput) {
      markerImageFileInput.onchange = function() {
        if (this.files && this.files[0]) imageFileLabelText.textContent = '🖼️ Выбрано: ' + this.files[0].name;
        else imageFileLabelText.textContent = '🖼️ Загрузить изображение';
      };
    }

    if (markerVideoFileInput) {
      markerVideoFileInput.onchange = function() {
        if (this.files && this.files[0]) videoFileLabelText.textContent = '🎥 Выбрано: ' + this.files[0].name;
        else videoFileLabelText.textContent = '🎥 Загрузить видео';
      };
    }

    function setupCustomSelect(boxId, selectedId, optionsId, onSelect) {
      var box = document.getElementById(boxId);
      var selected = document.getElementById(selectedId);
      var options = document.getElementById(optionsId);
      if (!box || !selected || !options) return;

      selected.onclick = function (e) {
        e.stopPropagation();
        var wasOpen = box.classList.contains('open');
        document.querySelectorAll('.custom-select-box').forEach(function (b) { b.classList.remove('open'); });
        if (!wasOpen) box.classList.add('open');
      };

      options.onclick = function (e) {
        var opt = e.target.closest('.custom-option');
        if (!opt) return;
        e.stopPropagation();
        var val = opt.getAttribute('data-value');
        selected.textContent = opt.textContent;
        box.classList.remove('open');
        options.querySelectorAll('.custom-option').forEach(function (o) { o.classList.remove('selected'); });
        opt.classList.add('selected');
        if (onSelect) onSelect(val, opt.textContent);
      };
    }

    function updateIconSelectOptions() {
      var box = document.getElementById('icon-select');
      var selected = document.getElementById('icon-selected');
      var container = document.getElementById('icon-options');
      if (!box || !selected || !container) return;

      container.innerHTML = '';
      var allowedIcons = [];
      CATEGORIES_CONFIG.forEach(function(cat) {
        if (cat.id === selectedCategoryValue) {
          if (cat.subcategories && selectedSubcategoryValue) {
            cat.subcategories.forEach(function(sub) {
              if (sub.id === selectedSubcategoryValue && sub.icons) allowedIcons = sub.icons;
            });
          } else if (cat.icons) allowedIcons = cat.icons;
        }
      });

      if (!selectedIconValue || !allowedIcons.includes(selectedIconValue)) {
        selectedIconValue = '';
        selected.innerHTML = '<span>Без иконки</span>';
      }

      var noneItem = document.createElement('div');
      noneItem.className = 'icon-option-item ' + (selectedIconValue === '' ? 'selected' : '');
      noneItem.innerHTML = '<span>Без иконки</span>';
      noneItem.onclick = function (e) {
        e.stopPropagation();
        selected.innerHTML = '<span>Без иконки</span>';
        selectedIconValue = '';
        box.classList.remove('open');
        container.querySelectorAll('.icon-option-item').forEach(function(i){ i.classList.remove('selected'); });
        noneItem.classList.add('selected');
      };
      container.appendChild(noneItem);

      allowedIcons.forEach(function (iconPath) {
        var item = document.createElement('div');
        item.className = 'icon-option-item ' + (selectedIconValue === iconPath ? 'selected' : '');
        var fileName = iconPath.split('/').pop();
        var cleanName = fileName.replace(/\.[^/.]+$/, "");
        item.innerHTML = '<img src="' + iconPath + '" alt="' + fileName + '"><span>' + cleanName + '</span>';

        item.onclick = function (e) {
          e.stopPropagation();
          selected.innerHTML = '<img src="' + iconPath + '" alt="' + fileName + '"><span>' + cleanName + '</span>';
          selectedIconValue = iconPath;
          box.classList.remove('open');
          container.querySelectorAll('.icon-option-item').forEach(function (i) { i.classList.remove('selected'); });
          item.classList.add('selected');
        };

        container.appendChild(item);
      });
    }

    function setupIconSelectDropdown() {
      var box = document.getElementById('icon-select');
      var selected = document.getElementById('icon-selected');
      if (!box || !selected) return;
      box.classList.remove('open');

      selected.onclick = function (e) {
        e.stopPropagation();
        var wasOpen = box.classList.contains('open');
        document.querySelectorAll('.custom-select-box').forEach(function (b) { b.classList.remove('open'); });
        if (!wasOpen) box.classList.add('open');
      };
    }

    document.onclick = function () {
      document.querySelectorAll('.custom-select-box').forEach(function (b) { b.classList.remove('open'); });
    };

    function updateSubcategoriesDropdown(categoryVal) {
      var subBox = document.getElementById('subcategory-select');
      var subOptionsContainer = document.getElementById('subcategory-options');
      var subSelected = document.getElementById('subcategory-selected');
      if (!subBox || !subOptionsContainer || !subSelected) return;

      subOptionsContainer.innerHTML = '';
      var targetCat = CATEGORIES_CONFIG.find(function(c){ return c.id === categoryVal; });

      if (targetCat && targetCat.subcategories && targetCat.subcategories.length > 0) {
        subBox.style.display = 'block';
        targetCat.subcategories.forEach(function(sub, idx) {
          var opt = document.createElement('div');
          opt.className = 'custom-option' + (idx === 0 ? ' selected' : '');
          opt.setAttribute('data-value', sub.id);
          opt.textContent = sub.title;
          subOptionsContainer.appendChild(opt);
        });
        selectedSubcategoryValue = targetCat.subcategories[0].id;
        subSelected.textContent = targetCat.subcategories[0].title;
      } else {
        subBox.style.display = 'none';
        selectedSubcategoryValue = '';
        subSelected.textContent = 'Подкатегория (не выбрана)';
      }
      updateIconSelectOptions();
    }

    setupCustomSelect('category-select', 'category-selected', 'category-options', function (val) {
      selectedCategoryValue = val;
      updateSubcategoriesDropdown(val);
    });

    setupCustomSelect('subcategory-select', 'subcategory-selected', 'subcategory-options', function (val) {
      selectedSubcategoryValue = val;
      updateIconSelectOptions();
    });

    setupIconSelectDropdown();
    updateSubcategoriesDropdown('loot');

    function setDropdownCategory(catId) {
      selectedCategoryValue = catId;
      var catObj = CATEGORIES_CONFIG.find(function(c) { return c.id === catId; });
      var catSelected = document.getElementById('category-selected');
      if (catSelected) catSelected.textContent = catObj ? catObj.title : 'Лут';
      updateSubcategoriesDropdown(catId);
    }

    function setDropdownSubcategory(subId) {
      selectedSubcategoryValue = subId;
      var targetCat = CATEGORIES_CONFIG.find(function(c) { return c.id === selectedCategoryValue; });
      var subTitle = 'Подкатегория (не выбрана)';
      if (targetCat && targetCat.subcategories) {
        var subObj = targetCat.subcategories.find(function(s) { return s.id === subId; });
        if (subObj) subTitle = subObj.title;
      }
      var subSelected = document.getElementById('subcategory-selected');
      if (subSelected) subSelected.textContent = subTitle;
      updateIconSelectOptions();
    }

    function setDropdownIcon(iconPath) {
      selectedIconValue = iconPath || '';
      var iconSelected = document.getElementById('icon-selected');
      if (iconSelected) {
        if (iconPath) {
          var fileName = iconPath.split('/').pop();
          var cleanName = fileName.replace(/\.[^/.]+$/, "");
          iconSelected.innerHTML = '<img src="' + iconPath + '" alt="' + fileName + '"><span>' + cleanName + '</span>';
        } else {
          iconSelected.innerHTML = '<span>Без иконки</span>';
        }
      }
    }

    function resetForm() {
      editingMarkerId = null;
      if (addMarkerBtn) addMarkerBtn.textContent = 'Добавить на карту';
      if (cancelEditBtn) cancelEditBtn.style.display = 'none';

      if (markerTitleInput) markerTitleInput.value = '';
      if (markerCoordsInput) markerCoordsInput.value = '';
      if (markerDescInput) markerDescInput.value = '';
      if (markerMediaInput) markerMediaInput.value = '';
      
      if (markerImageFileInput) markerImageFileInput.value = '';
      if (markerVideoFileInput) markerVideoFileInput.value = '';
      if (imageFileLabelText) imageFileLabelText.textContent = '🖼️ Загрузить изображение';
      if (videoFileLabelText) videoFileLabelText.textContent = '🎥 Загрузить видео';

      setDropdownCategory('loot');
      setDropdownSubcategory('valuable');
      setDropdownIcon('');
    }

    if (cancelEditBtn) {
      cancelEditBtn.onclick = resetForm;
    }

    window.editMarker = function (id) {
      if (!isAdmin()) {
        alert('У вас нет прав на редактирование!');
        return;
      }

      var item = markersData.find(function (m) { return m.id === id; });
      if (!item) return;

      editingMarkerId = id;
      closeCenteredPopup();

      var sidebarEl = document.getElementById('sidebar');
      if (sidebarEl) sidebarEl.classList.add('open');
      if (addMarkerSection) addMarkerSection.classList.add('open');
      if (addMarkerArrow) addMarkerArrow.style.transform = 'rotate(90deg)';

      if (markerTitleInput) markerTitleInput.value = item.title || '';
      if (markerCoordsInput) markerCoordsInput.value = item.coords ? JSON.stringify(item.coords) : '';
      if (markerDescInput) markerDescInput.value = item.description || '';
      if (markerMediaInput) markerMediaInput.value = item.media || '';

      setDropdownCategory(item.category || 'loot');
      if (item.subcategory) setDropdownSubcategory(item.subcategory);
      setDropdownIcon(item.icon || '');

      if (addMarkerBtn) addMarkerBtn.textContent = 'Сохранить изменения';
      if (cancelEditBtn) cancelEditBtn.style.display = 'block';
    };
function getMarkerCount(catId) {
      return markersData.filter(function (m) {
        var mTargetMap = m.map || 'farm';
        return mTargetMap === currentMapKey && (m.category === catId || m.subcategory === catId);
      }).length;
    }

    function renderCategoryTree() {
      if (!categoryTree) return;
      var searchQuery = filterSearch ? filterSearch.value.toLowerCase().trim() : '';
      categoryTree.innerHTML = '';

      CATEGORIES_CONFIG.forEach(function (cat) {
        var catCount = getMarkerCount(cat.id);
        var isCatActive = activeFilters.has(cat.id);
        var isExpanded = expandedCategories.has(cat.id);

        if (searchQuery && !cat.title.toLowerCase().includes(searchQuery)) return;

        var catCard = document.createElement('div');
        catCard.className = 'cat-card ' + (isCatActive ? '' : 'disabled');
        catCard.innerHTML =
          '<div class="cat-left">' +
            '<span class="eye-icon">' + (isCatActive ? '👁' : '🙈') + '</span>' +
            '<span class="cat-title">' + cat.title + '</span>' +
          '</div>' +
          '<div class="cat-right">' +
            '<span class="cat-count">' + catCount + '</span>' +
            ((cat.subcategories || (cat.icons && cat.icons.length > 0)) ? '<span class="chevron">' + (isExpanded ? '˅' : '›') + '</span>' : '') +
          '</div>';

        var eyeBtn = catCard.querySelector('.eye-icon');
        eyeBtn.onclick = function (e) {
          e.stopPropagation();
          if (isCatActive) {
            activeFilters.delete(cat.id);
            if (cat.subcategories) cat.subcategories.forEach(function (s) { activeFilters.delete(s.id); });
          } else {
            activeFilters.add(cat.id);
            if (cat.subcategories) cat.subcategories.forEach(function (s) { activeFilters.add(s.id); });
          }
          renderCategoryTree();
          renderMarkers();
        };

        if (cat.subcategories || (cat.icons && cat.icons.length > 0)) {
          catCard.onclick = function () {
            if (isExpanded) expandedCategories.delete(cat.id);
            else expandedCategories.add(cat.id);
            renderCategoryTree();
          };
        }

        categoryTree.appendChild(catCard);

        if (isExpanded) {
          if (cat.subcategories) {
            var subContainer = document.createElement('div');
            subContainer.className = 'sub-tree-container';

            cat.subcategories.forEach(function (sub) {
              var subCount = getMarkerCount(sub.id);
              var isSubActive = activeFilters.has(sub.id);
              var isSubExpanded = expandedSubcategories.has(sub.id);

              var subCard = document.createElement('div');
              subCard.className = 'subcat-wrapper';
              
              var subHeader = document.createElement('div');
              subHeader.className = 'cat-card ' + (isSubActive ? '' : 'disabled');
              subHeader.innerHTML =
                '<div class="cat-left">' +
                  '<span class="eye-icon">' + (isSubActive ? '👁' : '🙈') + '</span>' +
                  '<span class="cat-title">' + sub.title + '</span>' +
                '</div>' +
                '<div class="cat-right">' +
                  '<span class="cat-count">' + subCount + '</span>' +
                  (sub.icons && sub.icons.length > 0 ? '<span class="chevron">' + (isSubExpanded ? '˅' : '›') + '</span>' : '') +
                '</div>';

              var subEyeBtn = subHeader.querySelector('.eye-icon');
              subEyeBtn.onclick = function (e) {
                e.stopPropagation();
                if (isSubActive) activeFilters.delete(sub.id);
                else activeFilters.add(sub.id);
                renderCategoryTree();
                renderMarkers();
              };

              if (sub.icons && sub.icons.length > 0) {
                subHeader.onclick = function () {
                  if (isSubExpanded) expandedSubcategories.delete(sub.id);
                  else expandedSubcategories.add(sub.id);
                  renderCategoryTree();
                };
              }

              subCard.appendChild(subHeader);

              if (sub.icons && sub.icons.length > 0 && isSubExpanded) {
                var iconsGrid = document.createElement('div');
                iconsGrid.className = 'category-icons-grid';

                sub.icons.forEach(function (iconPath) {
                  var isIconActive = activeIconFilters.size === 0 || activeIconFilters.has(iconPath);
                  var iconCell = document.createElement('div');
                  iconCell.className = 'category-icon-cell ' + (isIconActive ? '' : 'inactive');
                  iconCell.innerHTML = '<img src="' + iconPath + '" alt="icon">';

                  iconCell.onclick = function (e) {
                    e.stopPropagation();
                    if (activeIconFilters.has(iconPath)) activeIconFilters.delete(iconPath);
                    else activeIconFilters.add(iconPath);
                    renderCategoryTree();
                    renderMarkers();
                  };

                  iconsGrid.appendChild(iconCell);
                });

                subCard.appendChild(iconsGrid);
              }

              subContainer.appendChild(subCard);
            });

            categoryTree.appendChild(subContainer);
          } else if (cat.icons && cat.icons.length > 0) {
            var directIconsGrid = document.createElement('div');
            directIconsGrid.className = 'category-icons-grid';
            directIconsGrid.style.marginLeft = '10px';
            directIconsGrid.style.marginBottom = '8px';

            cat.icons.forEach(function (iconPath) {
              var isIconActive = activeIconFilters.size === 0 || activeIconFilters.has(iconPath);
              var iconCell = document.createElement('div');
              iconCell.className = 'category-icon-cell ' + (isIconActive ? '' : 'inactive');
              iconCell.innerHTML = '<img src="' + iconPath + '" alt="icon">';

              iconCell.onclick = function (e) {
                e.stopPropagation();
                if (activeIconFilters.has(iconPath)) activeIconFilters.delete(iconPath);
                else activeIconFilters.add(iconPath);
                renderCategoryTree();
                renderMarkers();
              };

              directIconsGrid.appendChild(iconCell);
            });

            categoryTree.appendChild(directIconsGrid);
          }
        }
      });
    }

    function renderMarkers() {
      if (!markerGroup) return;
      markerGroup.clearLayers();
      if (!Array.isArray(markersData)) return;

      markersData.forEach(function (item) {
        var itemMap = item.map || 'farm';
        if (itemMap !== currentMapKey) return;

        var isVisibleCat = activeFilters.has(item.category) || activeFilters.has(item.subcategory);
        if (!isVisibleCat) return;

        if (activeIconFilters.size > 0 && item.icon && !activeIconFilters.has(item.icon)) {
          return;
        }

        var markerOptions = {};
        if (item.icon) {
          markerOptions.icon = L.icon({
            iconUrl: item.icon,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            popupAnchor: [0, -14]
          });
        }

        var marker = L.marker(item.coords, markerOptions);

        marker.on('click', function (e) {
          if (e && e.originalEvent) {
            e.originalEvent.stopPropagation();
          }
          openCenteredPopup(item);
        });

        markerGroup.addLayer(marker);
      });
    }
window.deleteMarker = function (id) {
      if (!isAdmin()) {
        alert('У вас нет прав на удаление!');
        return;
      }
      markerToDeleteId = id;
      closeCenteredPopup();
      if (confirmModal) confirmModal.classList.add('active');
    };

    if (cancelDeleteBtn) {
      cancelDeleteBtn.onclick = function () {
        markerToDeleteId = null;
        if (confirmModal) confirmModal.classList.remove('active');
      };
    }

    if (confirmDeleteBtn) {
      confirmDeleteBtn.onclick = function () {
        if (markerToDeleteId) {
          markersData = markersData.filter(function (m) { return m.id !== markerToDeleteId; });
          renderCategoryTree();
          renderMarkers();
          markerToDeleteId = null;
        }
        if (confirmModal) confirmModal.classList.remove('active');
      };
    }

    map.on('click', function (e) {
      var lat = e.latlng.lat;
      var lng = e.latlng.lng;
      var maxH = currentMapBounds[1][0];
      var maxW = currentMapBounds[1][1];

      if (lat >= 0 && lat <= maxH && lng >= 0 && lng <= maxW) {
        var rLat = Math.round(lat * 10) / 10;
        var rLng = Math.round(lng * 10) / 10;
        if (markerCoordsInput) markerCoordsInput.value = '[' + rLat + ', ' + rLng + ']';
      } else {
        if (markerCoordsInput) markerCoordsInput.value = '';
      }
    });

    function readFileAsBase64(file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    if (addMarkerBtn) {
      addMarkerBtn.onclick = async function () {
        if (!isAdmin()) {
          alert('У вас нет прав на создание или изменение меток! Введите пароль редактора через loginAdmin().');
          return;
        }

        if (!markerCoordsInput || !markerCoordsInput.value) {
          alert('Сначала кликните по карте, чтобы получить координаты!');
          return;
        }

        try {
          var coords = JSON.parse(markerCoordsInput.value);
          var lat = coords[0];
          var lng = coords[1];
          var maxH = currentMapBounds[1][0];
          var maxW = currentMapBounds[1][1];

          if (lat < 0 || lat > maxH || lng < 0 || lng > maxW) {
            alert('Нельзя ставить метку за пределами карты!');
            return;
          }

          var imageBase64 = null;
          var videoBase64 = null;

          if (markerImageFileInput && markerImageFileInput.files && markerImageFileInput.files[0]) {
            imageBase64 = await readFileAsBase64(markerImageFileInput.files[0]);
          }

          if (markerVideoFileInput && markerVideoFileInput.files && markerVideoFileInput.files[0]) {
            videoBase64 = await readFileAsBase64(markerVideoFileInput.files[0]);
          }

          var mediaText = markerMediaInput ? markerMediaInput.value : '';

          if (editingMarkerId) {
            var idx = markersData.findIndex(function (m) { return m.id === editingMarkerId; });
            if (idx !== -1) {
              var old = markersData[idx];
              markersData[idx] = {
                id: old.id,
                map: old.map || currentMapKey,
                createdBy: old.createdBy,
                category: selectedCategoryValue,
                subcategory: selectedSubcategoryValue || null,
                title: (markerTitleInput && markerTitleInput.value) || 'Новая метка',
                coords: coords,
                icon: selectedIconValue || null,
                image: imageBase64 !== null ? imageBase64 : old.image,
                video: videoBase64 !== null ? videoBase64 : old.video,
                media: mediaText,
                description: (markerDescInput && markerDescInput.value) || ''
              };
            }
          } else {
            var newMarker = {
              id: 'mark_' + Date.now(),
              map: currentMapKey,
              createdBy: currentUserId,
              category: selectedCategoryValue,
              subcategory: selectedSubcategoryValue || null,
              title: (markerTitleInput && markerTitleInput.value) || 'Новая метка',
              coords: coords,
              icon: selectedIconValue || null,
              image: imageBase64,
              video: videoBase64,
              media: mediaText,
              description: (markerDescInput && markerDescInput.value) || ''
            };
            markersData.push(newMarker);
          }

          renderCategoryTree();
          renderMarkers();
          resetForm();
        } catch (e) {
          alert('Ошибка при обработке метки или файлов');
        }
      };
    }

    if (saveJsonBtn) {
      saveJsonBtn.onclick = function () {
        var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(markersData, null, 2));
        var downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "markers.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      };
    }

    function fetchMarkers() {
      fetch('markers.json')
        .then(function (res) { return res.json(); })
        .then(function (data) {
          markersData = data;
          renderCategoryTree();
          renderMarkers();
        })
        .catch(function () {
          markersData = [];
          renderCategoryTree();
          renderMarkers();
        });
    }

    if (filterSearch) filterSearch.oninput = renderCategoryTree;

    var sidebar = document.getElementById('sidebar');
    var openBtn = document.getElementById('open-filters-btn');
    var closeBtn = document.getElementById('close-sidebar-btn');

    if (openBtn && sidebar) {
      openBtn.onclick = function () {
        sidebar.classList.add('open');
        setTimeout(function () { map.invalidateSize(); }, 300);
      };
    }
    if (closeBtn && sidebar) {
      closeBtn.onclick = function () { sidebar.classList.remove('open'); };
    }

    loadMap('farm');
    renderCategoryTree();
    fetchMarkers();
    return true;
  }

  function init() {
    if (!startApp()) {
      window.addEventListener('DOMContentLoaded', startApp);
      window.addEventListener('load', startApp);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 0);
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
